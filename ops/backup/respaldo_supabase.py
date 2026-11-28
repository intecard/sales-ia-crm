"""Copia local cifrada, de solo lectura, del esquema public del CRM de INTECA."""
import argparse
import getpass
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import warnings
from datetime import datetime, timezone
from uuid import uuid4

REF = "cldqyiyecxeagnzlylwr"
DIRECT = f"db.{REF}.supabase.co"
POOLER = re.compile(r"^(?:aws|gcp|azure)-[0-9]+-us-east-1\.pooler\.supabase\.com$")
PG_IMAGE = "postgres:17-bookworm"
TABLES = ("crm_whatsapp_memory", "crm_sales_opportunities", "crm_student_enrollments", "crm_community_jobs")


def connection(host, password):
    host = host.strip().lower()
    if host != DIRECT and not POOLER.fullmatch(host):
        raise ValueError("Pega solo el Host del Session pooler del proyecto INTECA; no pegues una URL ni la contraseña.")
    if not password:
        raise ValueError("La contraseña de la base de datos no puede estar vacía.")
    return {
        "PGHOST": host, "PGPORT": "5432", "PGDATABASE": "postgres",
        "PGUSER": "postgres" if host == DIRECT else f"postgres.{REF}",
        "PGPASSWORD": password, "PGCONNECT_TIMEOUT": "12",
        "PGSSLMODE": "verify-full", "PGSSLROOTCERT": "system",
        "PGAPPNAME": "inteca_private_backup",
    }


class PostgresCLI:
    def __init__(self, postgres_bin, certificate):
        path = Path(postgres_bin).resolve() if postgres_bin else None
        ext = ".exe" if os.name == "nt" else ""
        candidates = {n: str(path / (n + ext)) if path else shutil.which(n)
                      for n in ("psql", "pg_dump", "pg_restore")}
        if not path and not all(candidates.values()) and os.name == "nt":
            root = Path(os.getenv("ProgramFiles", "C:/Program Files")) / "PostgreSQL" / "17" / "bin"
            if (root / "pg_dump.exe").is_file():
                candidates = {n: str(root / (n + ext)) for n in candidates}
        self.native = candidates if all(candidates.values()) else None
        self.docker = shutil.which("docker")
        self.certificate = certificate
        if self.native:
            for executable in self.native.values():
                version = subprocess.check_output([executable, "--version"], text=True)
                match = re.search(r"\(PostgreSQL\) (\d+)", version)
                if not match or int(match[1]) < 17:
                    raise ValueError("Usa las herramientas PostgreSQL 17 o superiores (opción --postgres-bin).")
        elif not self.docker:
            raise ValueError("Se necesitan las herramientas PostgreSQL 17 o Docker Desktop iniciado.")
        else:
            result = subprocess.run([self.docker, "info", "--format", "{{.OSType}}"],
                                    capture_output=True, text=True, timeout=20)
            if result.returncode or result.stdout.strip() != "linux":
                raise ValueError("Abre Docker Desktop y espera a que esté iniciado en modo contenedores Linux.")

    def command(self, tool, args, pg=None):
        # The password is never interpolated into a connection URI or command argument.
        env = {k: v for k, v in os.environ.items() if not k.upper().startswith("PG")}
        pg = dict(pg or {})
        if self.native:
            if pg and self.certificate:
                pg["PGSSLROOTCERT"] = str(self.certificate)
            return [self.native[tool], *args], env | pg
        cmd = [self.docker, "run", "--rm", "-i"]
        if pg and self.certificate:
            if "," in str(self.certificate):
                raise ValueError("Mueve el certificado a una ruta sin comas.")
            cmd += ["--mount", f"type=bind,source={self.certificate},target=/supabase-ca.crt,readonly"]
            pg["PGSSLROOTCERT"] = "/supabase-ca.crt"
        for name in pg:
            cmd += ["--env", name]
        return [*cmd, PG_IMAGE, tool, *args], env | pg


def pipe(source, dest, *, source_env=None, dest_env=None, quiet=False):
    """Use binary OS pipes; Windows PowerShell must not reinterpret archive bytes."""
    with subprocess.Popen(source, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, env=source_env) as first:
        try:
            with subprocess.Popen(dest, stdin=first.stdout,
                                  stdout=subprocess.DEVNULL if quiet else None, env=dest_env) as second:
                first.stdout.close()
                try:
                    destination_code = second.wait()
                    source_code = first.wait()
                except BaseException:
                    first.terminate()
                    second.terminate()
                    raise
        except BaseException:
            if first.poll() is None:
                first.terminate()
            raise
    if source_code != 0 or destination_code != 0:
        raise RuntimeError("No se completó la exportación o la comprobación del archivo. Revisa el mensaje de la terminal.")


def check_crm(pg_cli, pg):
    checks = " and ".join(f"to_regclass('public.{table}') is not null" for table in TABLES)
    sql = f"select case when {checks} then 'INTECA_CRM_OK' else 'ESQUEMA_NO_COINCIDE' end"
    cmd, env = pg_cli.command("psql", ["--no-password", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], pg)
    result = subprocess.run(cmd, env=env, stdout=subprocess.PIPE, text=True, check=True)
    if result.stdout.strip() != "INTECA_CRM_OK":
        raise ValueError("La conexión no devolvió las tablas esperadas del CRM. No se generó ninguna copia.")


def sha256(file):
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def create_backup(pg_cli, pg, age, folder):
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
    final = folder / f"INTECA-CRM-{stamp}-{uuid4().hex[:8]}.dump.age"
    pending = final.with_suffix(".age.parcial")
    try:
        check_crm(pg_cli, pg)
        print("Conexión de solo lectura comprobada. Crea una frase para cifrar el respaldo. Consérvala por separado.", flush=True)
        dump, env = pg_cli.command("pg_dump", ["--no-password", "--format=custom", "--schema=public"], pg)
        pipe(dump, [age, "-p", "-o", str(pending)], source_env=env)
        del env
        # Read the entire archive to check authenticated decryption and decoding.
        # pg_restore emits SQL to the null device, never to a database or a file.
        print("Vuelve a escribir la misma frase para verificar la copia cifrada.", flush=True)
        restore, env = pg_cli.command("pg_restore", ["--exit-on-error", "--file=-"])
        pipe([age, "-d", str(pending)], restore, dest_env=env, quiet=True)
        digest = sha256(pending)
        pending.rename(final)
        return final, digest
    finally:
        pending.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", help="Host del Session pooler del proyecto, sin usuario ni contraseña.")
    parser.add_argument("--destino", type=Path, help="Carpeta local privada; por defecto AppData/Local/INTECA/Respaldos.")
    parser.add_argument("--postgres-bin", type=Path, help="Carpeta de psql, pg_dump y pg_restore versión 17 o superior.")
    parser.add_argument("--certificado", type=Path, help="Certificado raíz descargado del panel de Supabase, si es necesario.")
    parser.add_argument("--comprobar", action="store_true", help="Revisar herramientas sin conectarse ni pedir contraseña.")
    args = parser.parse_args()
    try:
        age = shutil.which("age")
        if not age:
            raise ValueError("Instala age (winget install --id FiloSottile.age) y abre una terminal nueva.")
        cert = args.certificado.resolve(strict=True) if args.certificado else None
        if cert and not cert.is_file():
            raise ValueError("El certificado debe ser un archivo del panel de Supabase.")
        pg_cli = PostgresCLI(args.postgres_bin, cert)
        if args.comprobar:
            print(f"Herramientas listas: age y {'PostgreSQL' if pg_cli.native else 'Docker'}. Aún no se conectó a Supabase.")
            return 0
        host = args.host or input("Pega solo el Host de Session pooler de Supabase: ")
        # If a usable terminal is unavailable, refuse to accept a visible password.
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            password = getpass.getpass("Contraseña de la BASE DE DATOS (no se muestra): ")
        pg = connection(host, password)
        del password
        folder = args.destino or Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "INTECA" / "Respaldos"
        final, digest = create_backup(pg_cli, pg, age, folder.resolve())
        print(f"RESPALDO CIFRADO VERIFICADO: {final}\nSHA-256: {digest}")
        print("Incluye el esquema public del CRM. Los archivos de Storage son un respaldo separado.")
    except (ValueError, RuntimeError, OSError, getpass.GetPassWarning, subprocess.SubprocessError) as error:
        # Never print a child environment or user-supplied connection string.
        message = str(error) if isinstance(error, (ValueError, RuntimeError)) else "Revisa que la terminal y las herramientas estén disponibles."
        print("No se completó el respaldo:", message, file=sys.stderr)
        return 1
    except (KeyboardInterrupt, EOFError):
        print("\nRespaldo cancelado.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
