import datetime as dt
import time
from pathlib import Path
import unittest
from unittest.mock import patch

import inteca_fotos as worker

JOB = {"asset": "a" * 32, "lease": "0ab03c8e-3ee0-4a0b-8a95-2ad83e132fcd",
       "prompt": 'Office with no people; "test" | $PATH', "people": False,
       "seed": 1024, "expiresAt": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=14)).isoformat()}


class LocalWorkerTest(unittest.TestCase):
    def test_forwards_a_real_rendered_png_with_lease(self):
        def fixture(_bin, _model, prompt, people, seed, output, _threads, deadline):
            self.assertEqual(prompt, JOB["prompt"])
            self.assertFalse(people)
            self.assertEqual(seed, 1024)
            self.assertGreater(deadline, time.time())
            output.write_bytes(worker.PNG + b"test image")

        with patch.object(worker, "generate", side_effect=fixture), patch.object(worker, "api") as api:
            worker.handle(JOB, "secret", Path("sd-cli"), Path("sdxl"), 2)
            api.assert_called_once_with("secret", "/upload", worker.PNG + b"test image", {
                "Content-Type": "image/png", "X-INTECA-Asset": JOB["asset"], "X-INTECA-Lease": JOB["lease"]})

    def test_timeout_reports_failure_and_does_not_upload(self):
        timeout = worker.subprocess.TimeoutExpired("sd-cli", 1)
        with patch.object(worker, "generate", side_effect=timeout), patch.object(worker, "api") as api:
            worker.handle(JOB, "secret", Path("sd-cli"), Path("sdxl"), 2)
            api.assert_called_once_with("secret", "/failure", {
                "asset": JOB["asset"], "lease": JOB["lease"], "error": "RENDER_TIMEOUT"})

    def test_rejects_unexpected_asset_before_executing(self):
        with patch.object(worker, "generate") as generate:
            with self.assertRaises(ValueError):
                worker.handle({**JOB, "asset": "../other"}, "secret", Path("sd-cli"), Path("sdxl"), 2)
            generate.assert_not_called()
