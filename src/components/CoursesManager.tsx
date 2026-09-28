import React, { useState } from 'react';
import {
  GraduationCap,
  Plus,
  Edit3,
  Trash2,
  BookOpen,
  DollarSign,
  Users,
  Award,
  Video,
  FileText,
  Sparkles,
  Check,
  X,
  Clock,
  Calendar
} from 'lucide-react';
import { Course } from '../types';

interface CoursesManagerProps {
  courses: Course[];
  onAddCourse: (course: Course) => void;
  onUpdateCourse: (course: Course) => void;
}

export const CoursesManager: React.FC<CoursesManagerProps> = ({
  courses,
  onAddCourse,
  onUpdateCourse
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<Course['category']>('Inteligencia Artificial');
  const [price, setPrice] = useState<number>(499);
  const [discountPrice, setDiscountPrice] = useState<number>(299);
  const [description, setDescription] = useState('');
  const [durationHours, setDurationHours] = useState<number>(120);
  const [schedule, setSchedule] = useState('');
  const [instructors, setInstructors] = useState('');

  const handleOpenAddModal = () => {
    setSelectedCourse(null);
    setTitle('');
    setCode(`INT-CR-${Math.floor(Math.random() * 900 + 100)}`);
    setCategory('Inteligencia Artificial');
    setPrice(499);
    setDiscountPrice(299);
    setDescription('');
    setDurationHours(120);
    setSchedule('Martes y Jueves 19:00 GMT-5');
    setInstructors('Dr. Carlos Alarcón');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (course: Course) => {
    setSelectedCourse(course);
    setTitle(course.title);
    setCode(course.code);
    setCategory(course.category);
    setPrice(course.price);
    setDiscountPrice(course.discountPrice || course.price);
    setDescription(course.description);
    setDurationHours(course.durationHours);
    setSchedule(course.schedule);
    setInstructors(course.instructors.join(', '));
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const courseData: Course = {
      id: selectedCourse ? selectedCourse.id : `crs_${Date.now()}`,
      title,
      code,
      category,
      price: Number(price),
      discountPrice: Number(discountPrice),
      description,
      durationHours: Number(durationHours),
      schedule,
      instructors: instructors.split(',').map((s) => s.trim()),
      modulesCount: selectedCourse?.modulesCount || 6,
      modulesList: selectedCourse?.modulesList || [
        { title: 'Módulo 1: Fundamentos Prácticos', topics: ['Introducción', 'Instalación', 'Primeros Pasos'] }
      ],
      materialsIncluded: ['Campus Virtual 24/7', 'Manuales PDF', 'Ejercicios Resueltos'],
      bonusesIncluded: ['Masterclass Especial de Estrategia'],
      certificationType: 'Diplomado Internacional',
      enrolledStudents: selectedCourse?.enrolledStudents || 150,
      status: 'Disponible'
    };

    if (selectedCourse) {
      onUpdateCourse(courseData);
    } else {
      onAddCourse(courseData);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <GraduationCap className="w-3.5 h-3.5 text-cyan-300" />
            <span>Catálogo Académico & Oferta Educativa INTECA</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Programas, Diplomados y Especializaciones</h1>
          <p className="text-xs text-slate-400 mt-1">
            Administra precios, promociones activas, becas, horarios, módulos y materiales entregados automáticamente tras el pago.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Registrar Nuevo Programa</span>
        </button>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-indigo-500/50 transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 bg-cyan-950 px-2.5 py-0.5 rounded border border-cyan-800">
                  {course.category}
                </span>
                <span className="text-xs font-mono text-slate-400">{course.code}</span>
              </div>

              <h2 className="text-lg font-bold text-white">{course.title}</h2>
              <p className="text-xs text-slate-300 leading-relaxed">{course.description}</p>

              {/* Specs pill list */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Duración: {course.durationHours} hrs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Alumnos: {course.enrolledStudents}</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span className="truncate">{course.schedule}</span>
                </div>
              </div>

              {/* Instructors */}
              <div className="text-xs text-slate-400">
                <strong>Docentes:</strong> {course.instructors.join(', ')}
              </div>
            </div>

            {/* Price & Action */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 line-through mr-2">${course.price} USD</span>
                <span className="text-xl font-black text-emerald-400">${course.discountPrice} USD</span>
              </div>

              <button
                onClick={() => handleOpenEditModal(course)}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Editar Programa</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Course Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-white">
              {selectedCourse ? 'Editar Programa Académico' : 'Crear Nuevo Programa INTECA'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium">Nombre del Programa *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                  >
                    <option value="Inteligencia Artificial">Inteligencia Artificial</option>
                    <option value="Marketing & Ventas">Marketing & Ventas</option>
                    <option value="Programación">Programación</option>
                    <option value="Gestión Empresarial">Gestión Empresarial</option>
                    <option value="Diseño & UX">Diseño & UX</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Código Interno</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Precio Regular ($ USD)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Precio Con Oferta Beca ($ USD)</label>
                  <input
                    type="number"
                    value={discountPrice}
                    onChange={(e) => setDiscountPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium">Descripción del Programa</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium">Horas Académicas</label>
                  <input
                    type="number"
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium">Horarios / Días</label>
                  <input
                    type="text"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium">Profesores / Docentes (separados por coma)</label>
                <input
                  type="text"
                  value={instructors}
                  onChange={(e) => setInstructors(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white mt-1"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl"
                >
                  Guardar Programa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
