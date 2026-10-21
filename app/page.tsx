"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Bus,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  MapPin,
  Calendar,
  Users,
  ArrowRight,
  ShieldAlert,
  Radio,
  Navigation,
  Compass,
} from "lucide-react";
import { Shuttle, TransitApiResponse, FirstLessonInfo } from "@/lib/types";

const STOPS = [
  { code: "UTOWN", name: "University Town", tag: "UTown", desc: "Residential College Hub" },
  { code: "COM3", name: "School of Computing", tag: "COM 3", desc: "Computing 1/2/3" },
  { code: "KR-MRT", name: "Kent Ridge MRT", tag: "KR-MRT", desc: "Circle Line Exchange" },
  { code: "CLB", name: "Central Library", tag: "CLB", desc: "Arts & Social Sciences" },
  { code: "LT27", name: "Science / LT 27", tag: "LT 27", desc: "Faculty of Science" },
  { code: "BIZ2", name: "Business School", tag: "BIZ 2", desc: "Mochtar Riady Bldg" },
];

const ROUTE_THEMES: Record<string, { bg: string; text: string; border: string; glow: string; name: string }> = {
  D1: { bg: "bg-rose-600", text: "text-white", border: "border-rose-500", glow: "text-rose-400", name: "Utown ⇄ BIZ 2" },
  D2: { bg: "bg-orange-600", text: "text-white", border: "border-orange-500", glow: "text-orange-400", name: "Utown ⇄ PGP / MRT" },
  A1: { bg: "bg-blue-600", text: "text-white", border: "border-blue-500", glow: "text-blue-400", name: "Kent Ridge Loop (Clockwise)" },
  A2: { bg: "bg-cyan-600", text: "text-white", border: "border-cyan-500", glow: "text-cyan-400", name: "Kent Ridge Loop (Anti-clockwise)" },
  K: { bg: "bg-emerald-600", text: "text-white", border: "border-emerald-500", glow: "text-emerald-400", name: "PGP ⇄ S17 / Science" },
  BTC: { bg: "bg-amber-500", text: "text-slate-950", border: "border-amber-400", glow: "text-amber-300", name: "Bukit Timah Express" },
};

function getRouteTheme(route: string) {
  const key = route.toUpperCase().trim();
  return (
    ROUTE_THEMES[key] || {
      bg: "bg-slate-700",
      text: "text-white",
      border: "border-slate-600",
      glow: "text-slate-300",
      name: "Campus Shuttle",
    }
  );
}

function getUrgencyBadge(arrivalTime: string, nextServiceTime?: string) {
  if (!arrivalTime || arrivalTime === "-" || arrivalTime.toLowerCase() === "n.a.") {
    return {
      label: nextServiceTime ? `Resumes ${nextServiceTime}` : "OFF SERVICE",
      color: "text-slate-500",
      bg: "bg-slate-900/60",
      border: "border-slate-800",
      indicator: "bg-slate-600",
      isArriving: false,
    };
  }

  const clean = arrivalTime.trim().toLowerCase();
  if (clean === "arr" || clean === "0") {
    return {
      label: "ARRIVING",
      color: "text-emerald-400",
      bg: "bg-emerald-950/50",
      border: "border-emerald-500/60",
      indicator: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
      isArriving: true,
    };
  }

  const mins = parseInt(clean, 10);
  if (isNaN(mins)) {
    return {
      label: arrivalTime,
      color: "text-slate-400",
      bg: "bg-slate-900/60",
      border: "border-slate-800",
      indicator: "bg-slate-500",
      isArriving: false,
    };
  }

  if (mins <= 3) {
    return {
      label: `${mins} MIN`,
      color: "text-emerald-400",
      bg: "bg-emerald-950/40",
      border: "border-emerald-500/50",
      indicator: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
      isArriving: true,
    };
  } else if (mins <= 8) {
    return {
      label: `${mins} MIN`,
      color: "text-amber-400",
      bg: "bg-amber-950/40",
      border: "border-amber-500/50",
      indicator: "bg-amber-400 shadow-[0_0_8px_#fbbf24]",
      isArriving: false,
    };
  } else {
    return {
      label: `${mins} MIN`,
      color: "text-rose-400",
      bg: "bg-rose-950/40",
      border: "border-rose-500/50",
      indicator: "bg-rose-400",
      isArriving: false,
    };
  }
}

export default function Home() {
  const [selectedStop, setSelectedStop] = useState<string>("UTOWN");
  const [transitData, setTransitData] = useState<TransitApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(20);
  const [moduleInput, setModuleInput] = useState<string>("");
  const [searchedModule, setSearchedModule] = useState<string>("");
  const [isSearchingModule, setIsSearchingModule] = useState<boolean>(false);
  const [moduleClassInfo, setModuleClassInfo] = useState<FirstLessonInfo | null | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [sgtClock, setSgtClock] = useState<string>("");

  // Singapore Clock (SGT, UTC+8)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const sgt = new Date(utc + 8 * 3600000);
      setSgtClock(
        sgt.toLocaleTimeString("en-SG", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTransit = useCallback(async (stopCode: string, modQuery?: string) => {
    try {
      const url = new URL("/api/transit", window.location.origin);
      url.searchParams.set("stop", stopCode);
      if (modQuery) {
        url.searchParams.set("module", modQuery);
      }
      const res = await fetch(url.toString());
      if (res.ok) {
        const data: TransitApiResponse = await res.json();
        setTransitData(data);
        if (modQuery !== undefined) {
          setModuleClassInfo(data.classInfo || null);
        }
      }
    } catch (err) {
      console.error("Failed to load transit data:", err);
    } finally {
      setIsLoading(false);
      setCountdown(20);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const execute = async () => {
      try {
        const url = new URL("/api/transit", window.location.origin);
        url.searchParams.set("stop", selectedStop);
        if (searchedModule) {
          url.searchParams.set("module", searchedModule);
        }
        const res = await fetch(url.toString());
        if (res.ok && !ignore) {
          const data: TransitApiResponse = await res.json();
          setTransitData(data);
          if (searchedModule) {
            setModuleClassInfo(data.classInfo || null);
          }
        }
      } catch (err) {
        if (!ignore) console.error("Transit sync error:", err);
      } finally {
        if (!ignore) {
          setIsLoading(false);
          setCountdown(20);
        }
      }
    };

    execute();
    return () => {
      ignore = true;
    };
  }, [selectedStop, searchedModule, refreshTrigger]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setRefreshTrigger((r) => r + 1);
          return 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleModuleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleInput.trim()) return;
    const clean = moduleInput.trim().toUpperCase();
    setSearchedModule(clean);
    setIsSearchingModule(true);
    await fetchTransit(selectedStop, clean);
    setIsSearchingModule(false);
  };

  const handleManualRefresh = () => {
    setIsLoading(true);
    setRefreshTrigger((r) => r + 1);
  };

  const currentStop = useMemo(() => {
    return STOPS.find((s) => s.code === selectedStop) || {
      code: selectedStop,
      name: transitData?.stopName || selectedStop,
      tag: selectedStop,
      desc: "Campus Stop",
    };
  }, [selectedStop, transitData]);

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 antialiased font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Advisory Ticker */}
      {transitData?.announcements && transitData.announcements.length > 0 && (
        <div className="bg-amber-950/80 border-b border-amber-600/50 px-4 py-2 text-xs text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold text-[10px] tracking-widest uppercase bg-amber-500 text-slate-950 px-1.5 py-0.2">
              DISRUPTION
            </span>
            <span className="truncate text-amber-200/90">{transitData.announcements.join(" • ")}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-5">
        {/* ================= HUD HEADER ================= */}
        <header className="bg-[#0D111A] border border-[#1C2333] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-[#003D7C] text-white flex flex-col items-center justify-center font-black tracking-tighter border border-blue-400/30">
              <span className="text-[10px] leading-tight text-blue-200">NUS</span>
              <span className="text-sm leading-none">ISB</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
                  Transit Command Hub
                </h1>
                <span className="text-[10px] font-mono tracking-widest px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  SYSTEM v2.4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official Campus Internal Shuttle Bus Real-Time Departure Display
              </p>
            </div>
          </div>

          {/* Real-time Telemetry Indicators */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            {/* Clock */}
            <div className="px-3 py-1.5 bg-[#131926] border border-[#212A3D] text-slate-200 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="tabular-nums font-bold text-white tracking-wider">{sgtClock || "00:00:00"}</span>
              <span className="text-[10px] text-slate-400">SGT</span>
            </div>

            {/* Mode Tag */}
            {transitData?.isScheduled ? (
              <div className="px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/40 text-amber-400 font-bold text-[11px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>SCHEDULED (ESTIMATED)</span>
              </div>
            ) : (
              <div className="px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-bold text-[11px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span>LIVE GPS FEED</span>
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="px-2.5 py-1.5 bg-[#131926] border border-[#212A3D] hover:border-slate-500 text-slate-300 hover:text-white transition flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
              title="Force sync data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-400" : "text-slate-400"}`} />
              <span className="tabular-nums">{countdown}s</span>
            </button>
          </div>
        </header>

        {/* ================= STATION PLATFORM SELECTOR RIBBON ================= */}
        <section className="bg-[#0D111A] border border-[#1C2333] p-2">
          <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase px-2 py-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-blue-400" />
              Select Departure Platform
            </span>
            <span className="text-slate-400 font-sans text-xs">
              Platform: <strong className="text-white font-mono">{currentStop.tag}</strong> ({currentStop.name})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 mt-1">
            {STOPS.map((stop) => {
              const active = selectedStop === stop.code;
              return (
                <button
                  key={stop.code}
                  onClick={() => setSelectedStop(stop.code)}
                  className={`p-2.5 text-left transition border relative group cursor-pointer ${
                    active
                      ? "bg-[#162033] border-blue-500 text-white shadow-[inset_0_0_12px_rgba(59,130,246,0.15)]"
                      : "bg-[#0A0E17] border-[#1C2333] text-slate-400 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black font-mono tracking-tight ${active ? "text-blue-400" : "text-slate-300"}`}
                    >
                      {stop.tag}
                    </span>
                    {active && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_6px_#60a5fa]" />}
                  </div>
                  <div className="text-[11px] font-medium truncate mt-0.5 text-slate-200">{stop.name}</div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">{stop.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ================= SPLIT PANE GRID ================= */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: DEPARTURES MATRIX (Cols: 7) */}
          <section className="lg:col-span-7 space-y-4">
            <div className="bg-[#0D111A] border border-[#1C2333]">
              {/* Departure Gate Bar */}
              <div className="p-4 border-b border-[#1C2333] flex items-center justify-between bg-[#101522]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                      <span>{transitData?.stopName || currentStop.name}</span>
                      <span className="font-mono text-xs text-blue-400 font-normal">[{selectedStop}]</span>
                    </h2>
                    <p className="text-[11px] text-slate-400 font-mono">LIVE PLATFORM DEPARTURES • REAL-TIME ETAS</p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-none shadow-[0_0_6px_#34d399]" /> ≤3m
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-amber-400 rounded-none shadow-[0_0_6px_#fbbf24]" /> 4-8m
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-rose-400 rounded-none" /> &gt;8m
                  </span>
                </div>
              </div>

              {/* Scheduled Timetable Alert */}
              {transitData?.isScheduled && (
                <div className="px-4 py-2 bg-amber-950/30 border-b border-amber-600/30 text-xs text-amber-300/90 flex items-center gap-2 font-mono">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    HEADWAY ESTIMATE: Derived from official ISB frequency tables (07:00 – 23:00 SGT, 6–10 min peak).
                  </span>
                </div>
              )}

              {/* Shuttle Board Rows */}
              <div className="p-3 divide-y divide-[#1C2333]/80">
                {isLoading && !transitData ? (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-[#121826] border border-[#1C2333] animate-pulse" />
                    ))}
                  </div>
                ) : !transitData?.shuttles || transitData.shuttles.length === 0 ? (
                  <div className="py-14 text-center space-y-2">
                    <Bus className="w-10 h-10 mx-auto text-slate-600" />
                    <div className="text-sm font-bold text-slate-300 font-mono">NO SHUTTLES CURRENTLY EN ROUTE</div>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      ISB operates 07:00 to 23:00 SGT daily. Normal shuttle service will resume tomorrow morning at 07:00.
                    </p>
                  </div>
                ) : (
                  transitData.shuttles.map((shuttle: Shuttle, idx: number) => {
                    const theme = getRouteTheme(shuttle.name);
                    const urgency = getUrgencyBadge(shuttle.arrivalTime, shuttle.nextServiceTime);

                    return (
                      <div
                        key={`${shuttle.name}-${idx}`}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-[#121826]/60 transition px-2"
                      >
                        {/* Route Identity Badge */}
                        <div className="flex items-center gap-3.5">
                          {/* Distinctive Route Square */}
                          <div
                            className={`w-14 h-14 ${theme.bg} ${theme.text} flex flex-col items-center justify-center font-black tracking-tight shrink-0 shadow-lg border ${theme.border}`}
                          >
                            <span className="text-xl leading-none">{shuttle.name}</span>
                            <span className="text-[8px] tracking-widest opacity-80 mt-0.5">ISB</span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-white tracking-wide">
                                NUS {shuttle.name}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">({theme.name})</span>
                            </div>

                            {/* Telemetry info: Plate, Crowd, Next */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-400">
                              {shuttle.vehplate && (
                                <span className="bg-[#161D2B] text-slate-200 px-1.5 py-0.2 border border-[#273248] text-[11px]">
                                  [ {shuttle.vehplate} ]
                                </span>
                              )}

                              {shuttle.passengers && (
                                <span className="flex items-center gap-1 text-slate-300 text-[11px]">
                                  <Users className="w-3 h-3 text-slate-400" />
                                  <span>{shuttle.passengers}</span>
                                </span>
                              )}

                              <span className="text-slate-400 text-[11px]">
                                Next:{" "}
                                <strong className="text-slate-200 tabular-nums font-bold">
                                  {shuttle.nextArrivalTime && shuttle.nextArrivalTime !== "-"
                                    ? `${shuttle.nextArrivalTime}m`
                                    : "N/A"}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* High-Impact Digital Arrival Display */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0">
                          <div
                            className={`px-4 py-2 font-mono font-black text-lg tracking-wider border ${urgency.bg} ${urgency.color} ${urgency.border} flex items-center gap-2`}
                          >
                            <span className={`w-2 h-2 ${urgency.indicator} rounded-none inline-block`} />
                            <span>{urgency.label}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* RIGHT: SMART COMMUTE FINDER & TELEGRAM (Cols: 5) */}
          <section className="lg:col-span-5 space-y-4">
            {/* Smart Commute Resolver */}
            <div className="bg-[#0D111A] border border-[#1C2333] p-5 space-y-4">
              <div className="border-b border-[#1C2333] pb-3 space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold tracking-wider">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  SMART CLASS COMMUTE RESOLVER
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Find Classroom Venue & Nearest Shuttle Stop
                </h3>
                <p className="text-xs text-slate-400">
                  Search an NUS module code to resolve timetable details, lesson venue, and nearest bus arrivals.
                </p>
              </div>

              {/* Module Search Input */}
              <form onSubmit={handleModuleSearch} className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. CS2030S, CS1101S, MA1521"
                    value={moduleInput}
                    onChange={(e) => setModuleInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-mono uppercase bg-[#070A10] border border-[#222B3D] text-white placeholder:normal-case placeholder:font-sans placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSearchingModule}
                  className="w-full py-2.5 bg-[#EF7C00] hover:bg-[#d96f00] text-slate-950 font-black text-xs uppercase tracking-wider transition active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {isSearchingModule ? "Resolving Timetable..." : "RESOLVE COMMUTE ROUTE"}
                </button>
              </form>

              {/* Quick Module Badges */}
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                <span>Quick:</span>
                {["CS2030S", "CS1101S", "MA1521"].map((code) => (
                  <button
                    key={code}
                    onClick={() => {
                      setModuleInput(code);
                      setSearchedModule(code);
                      fetchTransit(selectedStop, code);
                    }}
                    className="px-2 py-0.5 bg-[#121826] hover:bg-[#1C263A] border border-[#212A3D] text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    {code}
                  </button>
                ))}
              </div>

              {/* Resolved Card */}
              {moduleClassInfo && (
                <div className="border border-blue-500/40 bg-[#101726] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-blue-500/20 pb-2">
                    <div>
                      <div className="font-mono font-black text-sm text-blue-400">{moduleClassInfo.moduleCode}</div>
                      <div className="text-xs font-bold text-white leading-tight">{moduleClassInfo.title}</div>
                    </div>
                    <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 border border-blue-500/30">
                      SEM {moduleClassInfo.semester}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Time:</span>
                      <strong className="text-white">
                        {moduleClassInfo.day}, {moduleClassInfo.startTime} - {moduleClassInfo.endTime}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Lesson:</span>
                      <span className="text-white">
                        {moduleClassInfo.lessonType} ({moduleClassInfo.classNo})
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Venue:</span>
                      <span className="bg-slate-800 text-amber-300 px-1.5 py-0.2 font-bold">
                        {moduleClassInfo.venue}
                      </span>
                    </div>
                  </div>

                  {/* One-Click Platform Action */}
                  <div className="pt-2 border-t border-blue-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-mono uppercase text-slate-400 block">Nearest Stop</span>
                      <strong className="text-xs text-white">{moduleClassInfo.mappedStopName}</strong>
                    </div>

                    <button
                      onClick={() => setSelectedStop(moduleClassInfo.mappedStopCode)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono flex items-center gap-1 transition active:scale-95 cursor-pointer"
                    >
                      <span>VIEW DEPARTURES</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {moduleClassInfo === null && (
                <div className="p-3 bg-rose-950/30 border border-rose-600/40 text-xs text-rose-300 font-mono">
                  NO TIMETABLE RECORD FOUND FOR &quot;{searchedModule}&quot;.
                </div>
              )}
            </div>

            {/* Telegram Companion Card */}
            <div className="bg-[#0D111A] border border-[#1C2333] p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <span className="font-bold text-white block font-mono">TELEGRAM BOT COMPANION</span>
                <p className="text-slate-400 leading-normal text-[11px]">
                  Check live arrivals directly on Telegram. Send{" "}
                  <code className="text-blue-400 font-mono">/bus UTOWN</code> or{" "}
                  <code className="text-blue-400 font-mono">/class CS2030S</code> to our bot.
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#1C2333] py-4 text-center text-xs text-slate-500 font-mono space-y-1">
          <p>NUS CAMPUS TRANSIT HUB • ARCHITECTURAL DEPARTURES PLATFORM</p>
          <p className="text-[10px] text-slate-400">
            Powered by NUS NextBus & NUSMods OpenAPI • Headway intervals calculated in compliance with NUS ISB scheduling.
          </p>
        </footer>
      </div>
    </div>
  );
}
