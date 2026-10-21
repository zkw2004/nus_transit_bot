import { FirstLessonInfo, ModuleResponse } from "./types";

const NUSMODS_BASE_URL = "https://api.nusmods.com/v2/2025-2026";

// Fallback modules dictionary for offline resiliency and demos
const POPULAR_MODULE_MOCKS: Record<string, ModuleResponse> = {
  CS2030S: {
    moduleCode: "CS2030S",
    title: "Programming Methodology II",
    semesterData: [
      {
        semester: 2,
        timetable: [
          {
            classNo: "1",
            lessonType: "Lecture",
            day: "Wednesday",
            startTime: "1000",
            endTime: "1200",
            venue: "COM3-01-20",
          },
        ],
      },
    ],
  },
  CS1101S: {
    moduleCode: "CS1101S",
    title: "Programming Methodology",
    semesterData: [
      {
        semester: 1,
        timetable: [
          {
            classNo: "1",
            lessonType: "Lecture",
            day: "Friday",
            startTime: "1000",
            endTime: "1200",
            venue: "LT27",
          },
        ],
      },
    ],
  },
  MA1521: {
    moduleCode: "MA1521",
    title: "Calculus for Computing",
    semesterData: [
      {
        semester: 2,
        timetable: [
          {
            classNo: "1",
            lessonType: "Lecture",
            day: "Monday",
            startTime: "1400",
            endTime: "1600",
            venue: "UTOWN-AUD",
          },
        ],
      },
    ],
  },
};

export interface MappedStop {
  name: string;
  code: string;
}

/**
 * Maps classroom venue codes to the nearest bus stop based on the workspace rules.
 */
export function resolveVenueToBusStop(venue: string): MappedStop {
  if (!venue) {
    return { name: "University Town", code: "UTOWN" };
  }

  const v = venue.trim().toUpperCase();

  // COM1, COM2, COM3 -> COM 3 (COM3)
  if (v.includes("COM1") || v.includes("COM2") || v.includes("COM3")) {
    return { name: "COM 3", code: "COM3" };
  }

  // LT27, S17, SCIENCE -> LT 27 / Science (LT27)
  if (v.includes("LT27") || v.includes("S17") || v.includes("SCIENCE")) {
    return { name: "LT 27 / Science", code: "LT27" };
  }

  // UT, UTOWN, ERC -> University Town (UTOWN)
  if (v.includes("UTOWN") || v.includes("UT-") || v.startsWith("UT") || v.includes("ERC")) {
    return { name: "University Town", code: "UTOWN" };
  }

  // CLB, LIBRARY, AS -> Central Library / FASS (CLB)
  if (v.includes("CLB") || v.includes("LIBRARY") || v.startsWith("AS") || v.includes("AS1") || v.includes("AS2") || v.includes("AS3") || v.includes("AS4") || v.includes("AS5") || v.includes("AS6") || v.includes("AS7") || v.includes("AS8")) {
    return { name: "Central Library / FASS", code: "CLB" };
  }

  // BIZ1, BIZ2, HSSML -> BIZ 2 (BIZ2)
  if (v.includes("BIZ1") || v.includes("BIZ2") || v.includes("BIZ") || v.includes("HSSML") || v.includes("MOCHTAR")) {
    return { name: "BIZ 2", code: "BIZ2" };
  }

  // EA, E1, E2, ENG -> Engineering (EA)
  if (v.startsWith("EA") || v.startsWith("E1") || v.startsWith("E2") || v.startsWith("E3") || v.startsWith("E4") || v.startsWith("E5") || v.includes("ENG")) {
    return { name: "Engineering", code: "EA" };
  }

  // KR-MRT, NUH -> Kent Ridge MRT (KR-MRT)
  if (v.includes("KR-MRT") || v.includes("MRT") || v.includes("NUH")) {
    return { name: "Kent Ridge MRT", code: "KR-MRT" };
  }

  // Fallback
  return { name: "University Town", code: "UTOWN" };
}

/**
 * Fetches module timetable and data from NUSMods API.
 */
export async function fetchModuleData(moduleCode: string): Promise<ModuleResponse | null> {
  const cleanCode = moduleCode.trim().toUpperCase();
  const url = `${NUSMODS_BASE_URL}/modules/${cleanCode}.json`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache module definition for 24h
    });

    if (!response.ok) {
      console.warn(`NUSMods module not found [${response.status}]: ${cleanCode}`);
      return POPULAR_MODULE_MOCKS[cleanCode] || null;
    }

    const data = (await response.json()) as ModuleResponse;
    return data;
  } catch (error) {
    console.error(`Error fetching NUSMods data for ${cleanCode}:`, error);
    return POPULAR_MODULE_MOCKS[cleanCode] || null;
  }
}

/**
 * Extracts the primary/first scheduled lesson from the module and resolves the nearest bus stop.
 */
export function extractFirstLesson(module: ModuleResponse | null | undefined): FirstLessonInfo | null {
  if (!module || !module.semesterData || module.semesterData.length === 0) {
    return null;
  }

  // Find semester with timetable, prefer Semester 2 (current typical spring semester) or Semester 1
  const semData =
    module.semesterData.find((s) => s.semester === 2 && s.timetable?.length > 0) ||
    module.semesterData.find((s) => s.semester === 1 && s.timetable?.length > 0) ||
    module.semesterData.find((s) => s.timetable && s.timetable.length > 0);

  if (!semData || !semData.timetable || semData.timetable.length === 0) {
    return null;
  }

  // Pick first lesson (e.g. Lecture or Sectional)
  const lesson = semData.timetable[0];
  const mappedStop = resolveVenueToBusStop(lesson.venue);

  return {
    moduleCode: module.moduleCode,
    title: module.title,
    semester: semData.semester,
    lessonType: lesson.lessonType,
    classNo: lesson.classNo,
    day: lesson.day,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    venue: lesson.venue || "TBA",
    mappedStopName: mappedStop.name,
    mappedStopCode: mappedStop.code,
  };
}

