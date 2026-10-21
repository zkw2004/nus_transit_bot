// TypeScript interfaces for NUS NextBus, NUSMods, and Transit Hub

// --- NextBus Interfaces ---

export interface BusStop {
  caption: string;
  name: string;
  Longitude?: number;
  Latitude?: number;
}

export interface BusStopsResponse {
  BusStopsResult?: {
    busstops?: BusStop[];
  };
}

export interface NextBusEta {
  plate?: string;
  px?: string;
  ts?: string;
  jobid?: number;
  eta?: number;
  eta_s?: number;
}

export interface Shuttle {
  name: string;
  arrivalTime: string;
  nextArrivalTime: string;
  passengers?: string;
  nextPassengers?: string;
  vehplate?: string;
  nextVehplate?: string;
  arrivalTime_veh_plate?: string;
  nextArrivalTime_veh_plate?: string;
  _etas?: NextBusEta[];
  nextServiceTime?: string;
  isScheduled?: boolean;
}

export interface ShuttleServiceResponse {
  ShuttleServiceResult?: {
    caption?: string;
    name?: string;
    TimeStamp?: string;
    shuttles?: Shuttle[];
  };
}

export interface AnnouncementItem {
  id?: string | number;
  text?: string;
  created_on?: string;
}

export interface AnnouncementsResponse {
  AnnouncementsResult?: {
    Announcement?: AnnouncementItem | AnnouncementItem[];
  };
}

// --- NUSMods Interfaces ---

export interface TimetableLesson {
  classNo: string;
  lessonType: string;
  day: string;
  startTime: string;
  endTime: string;
  venue: string;
  weeks?: number[] | { start: string; end: string };
  size?: number;
}

export interface SemesterData {
  semester: number;
  timetable: TimetableLesson[];
}

export interface ModuleResponse {
  moduleCode: string;
  title: string;
  description?: string;
  semesterData: SemesterData[];
}

export interface FirstLessonInfo {
  moduleCode: string;
  title: string;
  semester: number;
  lessonType: string;
  classNo: string;
  day: string;
  startTime: string;
  endTime: string;
  venue: string;
  mappedStopName: string;
  mappedStopCode: string;
}

// --- Transit Hub API Aggregated Response ---

export interface TransitApiResponse {
  stopCode: string;
  stopName: string;
  serverTime?: string;
  isScheduled?: boolean;
  shuttles: Shuttle[];
  announcements: string[];
  classInfo?: FirstLessonInfo | null;
  error?: string;
}
