import React, { useState, useCallback } from 'react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addDays, 
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  subDays,
  isWithinInterval,
  isFuture,
  startOfDay,
  endOfDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, User, Edit, Trash2, FileText, Plus, History, X } from 'lucide-react';
import { Button } from '../ui/Button';
import NewConsultationModal from '../modals/NewConsultationModal';

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  date: Date;
  endTime: Date;
  duration: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  type: string;
  notes?: string;
  consultationId?: string;
  isHistorical?: boolean;
}

interface CalendarViewProps {
  appointments: Appointment[];
  currentDate: Date;
  view: 'day' | 'week' | 'month';
  onDateChange: (date: Date) => void;
  onViewChange: (view: 'day' | 'week' | 'month') => void;
  onTimeSlotClick: (date: Date, hour: number) => void;
  onAppointmentEdit: (appointmentId: string) => void;
  onAppointmentDelete: (appointmentId: string) => void;
  onAppointmentDrop?: (appointmentId: string, newDate: Date, newTime: string) => void;
  preselectedPatientId?: string;
  preselectedPatientName?: string;
  onAddConsultation?: (appointmentId: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  appointments,
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onTimeSlotClick,
  onAppointmentEdit,
  onAppointmentDelete,
  onAppointmentDrop,
  preselectedPatientId,
  preselectedPatientName,
  onAddConsultation
}) => {
  const [draggedAppointment, setDraggedAppointment] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isNewConsultationModalOpen, setIsNewConsultationModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [showMobileActions, setShowMobileActions] = useState<string | null>(null);

  // Track window resize for responsive behavior
  React.useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Time slots for the day (8 AM to 6 PM)
  const timeSlots = Array.from({ length: 11 }, (_, i) => i + 8);
  
  // Format time
  const formatTime = (hour: number) => {
    return `${hour}:00`;
  };
  
  // Navigate to previous period
  const goToPrevious = () => {
    if (view === 'week') {
      onDateChange(subWeeks(currentDate, 1));
    } else if (view === 'day') {
      onDateChange(addDays(currentDate, -1));
    } else if (view === 'month') {
      onDateChange(subMonths(currentDate, 1));
    }
  };
  
  // Navigate to next period
  const goToNext = () => {
    if (view === 'week') {
      onDateChange(addWeeks(currentDate, 1));
    } else if (view === 'day') {
      onDateChange(addDays(currentDate, 1));
    } else if (view === 'month') {
      onDateChange(addMonths(currentDate, 1));
    }
  };

  // Handle time slot click for creating new appointments
  const handleTimeSlotClick = (day: Date, hour: number) => {
    setSelectedSlot({ date: day, hour });
    console.log('Time slot clicked - preselected patient:', preselectedPatientId, preselectedPatientName);
    console.log('Selected slot:', { date: day, hour });
    setIsNewConsultationModalOpen(true);
  };

  // Handle new appointment success
  const handleNewConsultationSuccess = () => {
    setIsNewConsultationModalOpen(false);
    setSelectedSlot(null);
    console.log('New consultation created successfully');
    // Trigger a refresh of appointments data
    window.location.reload();
  };

  // Generate days for week view
  const generateWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Week starts on Monday
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  // Generate days for month view
  const generateMonthDays = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const monthDays = eachDayOfInterval({ start, end });

    // Add days from previous month to start on Monday
    const firstDay = monthDays[0];
    const prevMonthDays = eachDayOfInterval({
      start: startOfWeek(firstDay, { weekStartsOn: 1 }),
      end: subDays(firstDay, 1)
    });

    // Add days from next month to end on Sunday
    const lastDay = monthDays[monthDays.length - 1];
    const nextMonthDays = eachDayOfInterval({
      start: addDays(lastDay, 1),
      end: endOfWeek(lastDay, { weekStartsOn: 1 })
    });

    return [...prevMonthDays, ...monthDays, ...nextMonthDays];
  };
  
  // Check if an appointment is on a specific day and time
  const getAppointmentsForTimeSlot = (day: Date, hour: number) => {
    return appointments.filter(appointment => {
      const appointmentHour = appointment.date.getHours();
      return isSameDay(appointment.date, day) && appointmentHour === hour;
    });
  };

  // Get appointments for a specific day (month view)
  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(appointment => isSameDay(appointment.date, day));
  };
  
  // Format date range for display
  const formatDateRange = () => {
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'd', { locale: fr })} - ${format(end, 'd MMMM yyyy', { locale: fr })}`;
    } else if (view === 'day') {
      return format(currentDate, 'd MMMM yyyy', { locale: fr });
    } else if (view === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: fr });
    }
    return '';
  };

  // Get appointment color based on type and status
  const getAppointmentColor = (appointment: Appointment) => {
    // Si c'est un rendez-vous historique, utiliser une couleur spécifique
    if (appointment.isHistorical) {
      return 'bg-gray-100 text-gray-800 border-gray-200 border-dashed';
    }
    
    if (appointment.status === 'cancelled') {
      return 'bg-gray-100 text-gray-500 border-gray-200';
    }
    
    switch (appointment.type) {
      case 'Première consultation':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Consultation urgence':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Consultation enfant':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Consultation sportive':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Consultation historique':
        return 'bg-gray-100 text-gray-800 border-gray-200 border-dashed';
      default:
        return 'bg-primary-100 text-primary-800 border-primary-200';
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, appointmentId: string) => {
    setDraggedAppointment(appointmentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    
    if (draggedAppointment && onAppointmentDrop) {
      const newDateTime = new Date(day);
      newDateTime.setHours(hour, 0, 0, 0);
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      
      onAppointmentDrop(draggedAppointment, newDateTime, timeString);
    }
    
    setDraggedAppointment(null);
  }, [draggedAppointment, onAppointmentDrop]);

  const isSmallScreen = windowWidth < 768;
  const isMobileScreen = windowWidth < 640;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Calendar controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <Button
            variant="outline"
            size={isMobileScreen ? "sm" : "md"}
            onClick={goToPrevious}
            leftIcon={<ChevronLeft size={16} />}
          >
            {!isMobileScreen && "Précédent"}
          </Button>
          <Button 
            variant="outline" 
            size={isMobileScreen ? "sm" : "md"}
            onClick={() => onDateChange(new Date())}
          >
            {isMobileScreen ? "Auj." : "Aujourd'hui"}
          </Button>
          <Button
            variant="outline"
            size={isMobileScreen ? "sm" : "md"}
            onClick={goToNext}
            rightIcon={<ChevronRight size={16} />}
          >
            {!isMobileScreen && "Suivant"}
          </Button>
        </div>
        
        <h2 className="text-base sm:text-lg font-medium text-gray-900 text-center">{formatDateRange()}</h2>
        
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
              view === 'day' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => onViewChange('day')}
          >
            Jour
          </button>
          <button
            className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
              view === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => onViewChange('week')}
          >
            Semaine
          </button>
          <button
            className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
              view === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => onViewChange('month')}
          >
            Mois
          </button>
        </div>
      </div>

      {/* Week view */}
      {view === 'week' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {/* Day headers */}
          <div className={`grid ${isMobileScreen ? 'grid-cols-4' : 'grid-cols-8'} border-b border-gray-200`}>
            {!isMobileScreen && <div className="py-3 sm:py-4 px-1 sm:px-2 text-center bg-gray-50"></div>}
            {generateWeekDays().map((day, index) => (
              (!isMobileScreen || index < 3) && (
              <div 
                key={index} 
                className={`py-3 sm:py-4 px-1 sm:px-2 text-center ${!isMobileScreen ? 'border-l border-gray-200' : ''} ${
                  isSameDay(day, new Date()) ? 'bg-primary-50' : 'bg-gray-50'
                }`}
              >
                <p className="text-xs sm:text-sm font-medium text-gray-900">
                  {format(day, isMobileScreen ? 'EEE' : 'EEEE', { locale: fr })}
                </p>
                <p className={`text-lg sm:text-2xl font-bold ${
                  isSameDay(day, new Date()) ? 'text-primary-600' : 'text-gray-900'
                }`}>
                  {format(day, 'd', { locale: fr })}
                </p>
              </div>
              )
            ))}
          </div>
          
          {/* Time slots */}
          {timeSlots.map((hour) => (
            <div key={hour} className={`grid ${isMobileScreen ? 'grid-cols-4' : 'grid-cols-8'} border-b border-gray-100`}>
              {!isMobileScreen && (
              <div className="py-2 sm:py-3 px-1 sm:px-2 text-center text-xs sm:text-sm text-gray-500 bg-gray-50 border-r border-gray-200">
                {formatTime(hour)}
              </div>
              )}
              
              {generateWeekDays().map((day, dayIndex) => {
                if (isMobileScreen && dayIndex >= 3) return null;
                const appointments = getAppointmentsForTimeSlot(day, hour);
                
                return (
                  <div 
                    key={dayIndex} 
                    className={`relative h-12 sm:h-16 ${!isMobileScreen ? 'border-l border-gray-200' : ''} cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSameDay(day, new Date()) ? 'bg-primary-50/30' : ''
                    }`}
                    onClick={() => handleTimeSlotClick(day, hour)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, day, hour)}
                  >
                    {/* Mobile time indicator */}
                    {isMobileScreen && appointments.length === 0 && (
                      <div className="absolute top-1 left-1 text-xs text-gray-400">
                        {formatTime(hour)}
                      </div>
                    )}
                    
                    {appointments.map((appointment) => (
                      <div 
                        key={appointment.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, appointment.id)}
                        className={`absolute inset-1 rounded-lg p-1 sm:p-2 text-xs border cursor-move hover:shadow-md transition-shadow group ${
                          getAppointmentColor(appointment)
                        } ${draggedAppointment === appointment.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1 relative">
                          <div className="flex items-center text-xs truncate flex-1">
                            {appointment.isHistorical && <History size={10} className="mr-1" />}
                            {!isMobileScreen && <Clock size={10} className="mr-1" />}
                            <span>
                              {format(appointment.date, 'HH:mm')}{!isMobileScreen && ` - ${format(appointment.endTime, 'HH:mm')}`}
                            </span>
                          </div>
                          
                          {/* Desktop actions */}
                          {!isMobileScreen && (
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {appointment.status !== 'completed' && !appointment.consultationId && !appointment.isHistorical && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onAddConsultation) onAddConsultation(appointment.id);
                                }}
                                className="hover:text-green-600 transition-colors"
                                title="Ajouter une consultation"
                              >
                                <Plus size={10} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentEdit(appointment.id);
                              }}
                              className="hover:text-blue-600 transition-colors"
                              title="Modifier"
                            >
                              <Edit size={10} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentDelete(appointment.id);
                              }}
                              className="hover:text-red-600 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                          )}
                          
                          {/* Mobile actions */}
                          {isMobileScreen && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowMobileActions(showMobileActions === appointment.id ? null : appointment.id);
                              }}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <Edit size={12} />
                            </button>
                          )}
                        </div>
                        
                        <div className="font-medium truncate text-xs">{appointment.patientName}</div>
                        {!isMobileScreen && (
                          <div className="text-xs opacity-75 truncate">{appointment.type}</div>
                        )}
                        {appointment.consultationId && (
                          <div className="mt-1 text-xs bg-blue-50 text-blue-700 px-1 py-0.5 rounded truncate">
                            {isMobileScreen ? "Consult." : "Consultation enregistrée"}
                          </div>
                        )}
                        
                        {/* Mobile action menu */}
                        {isMobileScreen && showMobileActions === appointment.id && (
                          <div className="absolute top-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2 space-y-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentEdit(appointment.id);
                                setShowMobileActions(null);
                              }}
                              className="flex items-center w-full text-left text-xs text-blue-600 hover:bg-blue-50 p-1 rounded"
                            >
                              <Edit size={12} className="mr-1" />
                              Modifier
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentDelete(appointment.id);
                                setShowMobileActions(null);
                              }}
                              className="flex items-center w-full text-left text-xs text-red-600 hover:bg-red-50 p-1 rounded"
                            >
                              <Trash2 size={12} className="mr-1" />
                              Supprimer
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowMobileActions(null);
                              }}
                              className="flex items-center w-full text-left text-xs text-gray-600 hover:bg-gray-50 p-1 rounded"
                            >
                              <X size={12} className="mr-1" />
                              Fermer
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Empty slot indicator for mobile */}
                    {isMobileScreen && appointments.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Plus size={16} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          
          {/* Mobile week navigation */}
          {isMobileScreen && (
            <div className="p-4 bg-gray-50 border-t">
              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newWeek = subWeeks(currentDate, 1);
                    onDateChange(newWeek);
                  }}
                  leftIcon={<ChevronLeft size={14} />}
                >
                  Semaine précédente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newWeek = addWeeks(currentDate, 1);
                    onDateChange(newWeek);
                  }}
                  rightIcon={<ChevronRight size={14} />}
                >
                  Semaine suivante
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Day view */}
      {view === 'day' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">
              {format(currentDate, 'EEEE d MMMM', { locale: fr })}
            </h3>
          </div>
          
          {timeSlots.map((hour) => {
            const appointments = getAppointmentsForTimeSlot(currentDate, hour);
            
            return (
              <div key={hour} className={`grid ${isMobileScreen ? 'grid-cols-1' : 'grid-cols-12'} border-b border-gray-100`}>
                {!isMobileScreen && (
                <div className="col-span-1 py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm text-gray-500 bg-gray-50 border-r border-gray-200">
                  {formatTime(hour)}
                </div>
                )}
                
                <div 
                  className={`${isMobileScreen ? 'col-span-1' : 'col-span-11 border-l'} py-3 sm:py-4 px-2 sm:px-4 min-h-16 sm:min-h-20 cursor-pointer hover:bg-gray-50 transition-colors relative`}
                  onClick={() => handleTimeSlotClick(currentDate, hour)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, currentDate, hour)}
                >
                  {/* Mobile time indicator */}
                  {isMobileScreen && (
                    <div className="absolute top-2 left-2 text-xs text-gray-500 font-medium">
                      {formatTime(hour)}
                    </div>
                  )}
                  
                  {appointments.map(appointment => (
                    <div 
                      key={appointment.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, appointment.id)}
                      className={`group rounded-lg p-2 sm:p-3 mb-2 border cursor-move hover:shadow-md transition-shadow ${
                        getAppointmentColor(appointment)
                      } ${draggedAppointment === appointment.id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm sm:text-base font-medium flex items-center truncate">
                              {appointment.isHistorical && <History size={14} className="mr-1" />}
                              {appointment.patientName}
                            </h4>
                            
                            {/* Desktop actions */}
                            {!isMobileScreen && (
                            <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {appointment.status !== 'completed' && !appointment.consultationId && !appointment.isHistorical && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onAddConsultation) onAddConsultation(appointment.id);
                                  }}
                                  className="p-1 hover:bg-white/50 rounded transition-all"
                                  title="Ajouter une consultation"
                                >
                                  <FileText size={14} />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAppointmentEdit(appointment.id);
                                }}
                                className="p-1 hover:bg-white/50 rounded transition-all"
                                title="Modifier"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAppointmentDelete(appointment.id);
                                }}
                                className="p-1 hover:bg-white/50 rounded transition-all"
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            )}
                            
                            {/* Mobile actions */}
                            {isMobileScreen && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMobileActions(showMobileActions === appointment.id ? null : appointment.id);
                                }}
                                className="p-1 text-gray-500 hover:text-gray-700"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm opacity-90 truncate">{appointment.type}</p>
                          <div className="flex items-center text-xs sm:text-sm opacity-75 mt-1">
                            <Clock size={12} className="mr-1" />
                            <span>
                              {format(appointment.date, 'HH:mm')} - {format(appointment.endTime, 'HH:mm')} 
                              {!isMobileScreen && ` (${appointment.duration} min)`}
                            </span>
                          </div>
                          {appointment.notes && (
                            <p className="text-xs sm:text-sm opacity-75 mt-2 truncate">{appointment.notes}</p>
                          )}
                          {appointment.consultationId && (
                            <div className="mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded inline-block truncate">
                              {isMobileScreen ? "Consult. enreg." : "Consultation enregistrée"}
                            </div>
                          )}
                          {appointment.isHistorical && (
                            <div className="mt-2 text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded inline-block truncate">
                              {isMobileScreen ? "Historique" : "Rendez-vous historique"}
                            </div>
                          )}
                          
                          {/* Mobile action menu */}
                          {isMobileScreen && showMobileActions === appointment.id && (
                            <div className="absolute top-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2 space-y-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAppointmentEdit(appointment.id);
                                  setShowMobileActions(null);
                                }}
                                className="flex items-center w-full text-left text-xs text-blue-600 hover:bg-blue-50 p-1 rounded"
                              >
                                <Edit size={12} className="mr-1" />
                                Modifier
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAppointmentDelete(appointment.id);
                                  setShowMobileActions(null);
                                }}
                                className="flex items-center w-full text-left text-xs text-red-600 hover:bg-red-50 p-1 rounded"
                              >
                                <Trash2 size={12} className="mr-1" />
                                Supprimer
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMobileActions(null);
                                }}
                                className="flex items-center w-full text-left text-xs text-gray-600 hover:bg-gray-50 p-1 rounded"
                              >
                                <X size={12} className="mr-1" />
                                Fermer
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {appointments.length === 0 && (
                    <div className="w-full h-full min-h-[40px] sm:min-h-[60px] border border-dashed border-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-xs sm:text-sm text-gray-400">
                        {isMobileScreen ? "Ajouter RDV" : "Cliquez pour ajouter un rendez-vous"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month view */}
      {view === 'month' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {/* Week days header */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day) => (
              <div key={day} className="py-2 sm:py-3 text-center text-xs sm:text-sm font-medium text-gray-900 bg-gray-50">
                {isMobileScreen ? day.substring(0, 1) : isSmallScreen ? day.substring(0, 3) : day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {generateMonthDays().map((day, index) => {
              const dayAppointments = getAppointmentsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={`min-h-[60px] sm:min-h-[100px] md:min-h-[120px] p-1 sm:p-2 border-b border-r border-gray-100 relative cursor-pointer hover:bg-gray-50 transition-colors ${
                    !isCurrentMonth ? 'bg-gray-50/50' : ''
                  } ${isToday ? 'bg-primary-50' : ''}`}
                  onClick={() => {
                    onDateChange(day);
                    onViewChange('day');
                  }}
                >
                  <div className={`text-right mb-1 sm:mb-2 text-xs sm:text-sm ${
                    isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                  } ${isToday ? 'font-bold text-primary-600' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1">
                    {dayAppointments.slice(0, isMobileScreen ? 1 : 3).map((appointment) => (
                      <div
                        key={appointment.id}
                        className={`text-xs p-1 rounded truncate flex items-center group relative ${getAppointmentColor(appointment)}`}
                      >
                        {appointment.isHistorical && <History size={10} className="mr-1 flex-shrink-0" />}
                        <span className="truncate flex-grow">
                          {isMobileScreen ? appointment.patientName : `${format(appointment.date, 'HH:mm')} - ${appointment.patientName}`}
                        </span>
                        
                        {/* Desktop actions */}
                        {!isMobileScreen && (
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAppointmentEdit(appointment.id);
                            }}
                            className="hover:text-blue-600"
                            title="Modifier"
                          >
                            <Edit size={10} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAppointmentDelete(appointment.id);
                            }}
                            className="hover:text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                        )}
                        
                        {/* Mobile tap to edit */}
                        {isMobileScreen && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAppointmentEdit(appointment.id);
                            }}
                            className="absolute inset-0 w-full h-full"
                            aria-label="Modifier le rendez-vous"
                          />
                        )}
                      </div>
                    ))}
                    {dayAppointments.length > (isMobileScreen ? 1 : 3) && (
                      <div className="text-xs text-gray-500 pl-1 cursor-pointer hover:text-gray-700"
                           onClick={(e) => {
                             e.stopPropagation();
                             onDateChange(day);
                             onViewChange('day');
                           }}>
                        +{dayAppointments.length - (isMobileScreen ? 1 : 3)} {isMobileScreen ? '' : 'autres'}
                      </div>
                    )}
                    
                    {/* Add appointment button for empty days */}
                    {dayAppointments.length === 0 && (
                      <div 
                        className="flex items-center justify-center h-8 border border-dashed border-gray-200 rounded hover:border-primary-300 hover:bg-primary-50 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTimeSlotClick(day, 9); // Default to 9 AM
                        }}
                      >
                        <Plus size={12} className="text-gray-400 hover:text-primary-500" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="text-xs sm:text-sm font-medium text-gray-900 mb-3">Légende des types de consultation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded bg-primary-100 border border-primary-200 mr-2"></div>
            <span className="text-xs sm:text-sm text-gray-700">Consultation ostéopathique</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded bg-blue-100 border border-blue-200 mr-2"></div>
            <span className="text-xs sm:text-sm text-gray-700">Première consultation</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-200 mr-2"></div>
            <span className="text-xs sm:text-sm text-gray-700">Consultation urgence</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-200 mr-2"></div>
            <span className="text-xs sm:text-sm text-gray-700">Consultation enfant</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded bg-purple-100 border border-purple-200 mr-2"></div>
            <span className="text-xs sm:text-sm text-gray-700">Consultation sportive</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200 mr-2"></div>
            <span className="text-xs sm:text-sm text-gray-700">Annulé</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200 border-dashed mr-2"></div>
            <span className="text-xs sm:text-sm text-gray-700">Rendez-vous historique</span>
          </div>
        </div>
      </div>
      
      {/* New Consultation Modal */}
      <NewConsultationModal
        isOpen={isNewConsultationModalOpen}
        onClose={() => {
          setIsNewConsultationModalOpen(false);
          setSelectedSlot(null);
        }}
        onSuccess={handleNewConsultationSuccess}
        preselectedDate={selectedSlot?.date.toISOString().split('T')[0]}
        preselectedTime={selectedSlot ? `${selectedSlot.hour.toString().padStart(2, '0')}:00` : undefined}
        preselectedPatientId={preselectedPatientId}
        preselectedPatientName={preselectedPatientName}
      />
    </div>
  );
};

export default CalendarView;