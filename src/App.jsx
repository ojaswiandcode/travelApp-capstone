import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const OPENWEATHER_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_KEY;

function useLeaflet(mapRef, lat, lon, attractions) {
  useEffect(() => {
    if (!mapRef.current) return;
    if (!window.L) return;
    const L = window.L;
    mapRef.current.innerHTML = "";
    const map = L.map(mapRef.current).setView([lat, lon], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    L.marker([lat, lon]).addTo(map).bindPopup("📍 City Center").openPopup();
    attractions.forEach((a) => {
      if (a.lat && a.lon)
        L.marker([a.lat, a.lon]).addTo(map).bindPopup(`🏛 ${a.name}`);
    });
    return () => map.remove();
  }, [lat, lon, attractions]);
}

function useDebounce(value, delay = 500) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

function useAuth() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("travel_user")); } catch { return null; }
  });
  const login = (email, pass) => {
    if (!email || !pass) return "Fill all fields";
    const u = { email, name: email.split("@")[0], savedTrips: [] };
    localStorage.setItem("travel_user", JSON.stringify(u));
    setUser(u);
    return null;
  };
  const signup = login;
  const logout = () => { localStorage.removeItem("travel_user"); setUser(null); };
  const saveTrip = (trip) => {
    setUser((u) => {
      const next = { ...u, savedTrips: [...(u.savedTrips || []), trip] };
      localStorage.setItem("travel_user", JSON.stringify(next));
      return next;
    });
  };
  return { user, login, signup, logout, saveTrip };
}

const DESTINATIONS = [
  { city:"Paris",       country:"France",        lat:48.8566,  lon:2.3522,   type:"Cultural",  budget:"High",   tempC:14, pop:95 },
  { city:"Bali",        country:"Indonesia",     lat:-8.3405,  lon:115.092,  type:"Beach",     budget:"Low",    tempC:28, pop:92 },
  { city:"Tokyo",       country:"Japan",         lat:35.6762,  lon:139.6503, type:"Cultural",  budget:"Medium", tempC:16, pop:97 },
  { city:"New York",    country:"USA",           lat:40.7128,  lon:-74.006,  type:"City",      budget:"High",   tempC:13, pop:98 },
  { city:"Santorini",   country:"Greece",        lat:36.3932,  lon:25.4615,  type:"Beach",     budget:"High",   tempC:22, pop:88 },
  { city:"Machu Picchu",country:"Peru",          lat:-13.1631, lon:-72.545,  type:"Adventure", budget:"Medium", tempC:12, pop:85 },
  { city:"Dubai",       country:"UAE",           lat:25.2048,  lon:55.2708,  type:"City",      budget:"High",   tempC:30, pop:90 },
  { city:"Barcelona",   country:"Spain",         lat:41.3851,  lon:2.1734,   type:"Cultural",  budget:"Medium", tempC:18, pop:91 },
  { city:"Cape Town",   country:"South Africa",  lat:-33.9249, lon:18.4241,  type:"Adventure", budget:"Medium", tempC:17, pop:83 },
  { city:"Kyoto",       country:"Japan",         lat:35.0116,  lon:135.7681, type:"Cultural",  budget:"Medium", tempC:15, pop:87 },
  { city:"Maldives",    country:"Maldives",      lat:3.2028,   lon:73.2207,  type:"Beach",     budget:"High",   tempC:29, pop:86 },
  { city:"Petra",       country:"Jordan",        lat:30.3285,  lon:35.4444,  type:"Adventure", budget:"Medium", tempC:20, pop:80 },
];

const MOCK_ATTRACTIONS = {
  Paris:     [{name:"Eiffel Tower",lat:48.8584,lon:2.2945},{name:"Louvre",lat:48.8606,lon:2.3376},{name:"Notre-Dame",lat:48.8530,lon:2.3499}],
  Tokyo:     [{name:"Shibuya Crossing",lat:35.6595,lon:139.7004},{name:"Senso-ji",lat:35.7148,lon:139.7967},{name:"Shinjuku",lat:35.6938,lon:139.7036}],
  Bali:      [{name:"Ubud Palace",lat:-8.5069,lon:115.2625},{name:"Tanah Lot",lat:-8.6214,lon:115.0868},{name:"Kuta Beach",lat:-8.7185,lon:115.1686}],
  Barcelona: [{name:"Sagrada Família",lat:41.4036,lon:2.1744},{name:"Park Güell",lat:41.4145,lon:2.1527},{name:"Las Ramblas",lat:41.3797,lon:2.1740}],
  default:   [{name:"City Center",lat:0,lon:0}],
};

const HOTEL_COSTS    = { Budget:30, Mid:80, Luxury:250 };
const FOOD_COSTS     = { Street:15, Restaurant:40, Fine:100 };
const ACTIVITY_COSTS = { Adventure:60, Relaxation:30, Cultural:25, Beach:10 };
const PIE_COLORS     = ["#06b6d4","#f97316","#8b5cf6","#10b981","#f43f5e"];
const STEPS          = ["Destination","Dates","Budget","Activities","Generate"];
function globalCSS(dark) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #06b6d4; border-radius: 3px; }
    .glass {
      background: ${dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.65)"};
      backdrop-filter: blur(16px);
      border: 1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.8)"};
      border-radius: 20px;
    }
    .glass-card {
      background: ${dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)"};
      backdrop-filter: blur(12px);
      border: 1px solid ${dark ? "rgba(6,182,212,0.20)" : "rgba(6,182,212,0.25)"};
      border-radius: 16px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .glass-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(6,182,212,0.15); }
    .btn-primary {
      background: linear-gradient(135deg, #06b6d4, #0ea5e9);
      color: white; border: none; cursor: pointer; font-weight: 600;
      border-radius: 12px; padding: 0.65rem 1.5rem; transition: all 0.2s;
      font-family: 'Sora', sans-serif;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(6,182,212,0.4); }
    .btn-secondary {
      background: transparent;
      border: 1px solid ${dark ? "rgba(6,182,212,0.4)" : "rgba(6,182,212,0.6)"};
      color: #06b6d4; cursor: pointer; font-weight: 600;
      border-radius: 12px; padding: 0.65rem 1.5rem; transition: all 0.2s;
      font-family: 'Sora', sans-serif;
    }
    .btn-secondary:hover { background: rgba(6,182,212,0.1); }
    .input-glass {
      background: ${dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.8)"};
      border: 1px solid ${dark ? "rgba(6,182,212,0.25)" : "rgba(6,182,212,0.35)"};
      border-radius: 12px; padding: 0.7rem 1rem; width: 100%;
      color: ${dark ? "white" : "#0f172a"}; outline: none;
      font-family: 'Sora', sans-serif; font-size: 0.9rem;
      transition: border-color 0.2s;
    }
    .input-glass:focus { border-color: #06b6d4; box-shadow: 0 0 0 3px rgba(6,182,212,0.1); }
    .input-glass::placeholder { color: ${dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.35)"}; }
    .glow-text { background: linear-gradient(135deg, #06b6d4, #38bdf8, #f97316); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .tag { display: inline-block; padding: 0.2rem 0.65rem; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
    .chip { padding: 0.35rem 0.9rem; border-radius: 20px; border: 1px solid rgba(6,182,212,0.35); cursor: pointer; font-size: 0.82rem; font-weight: 500; transition: all 0.2s; }
    .chip.active { background: linear-gradient(135deg,#06b6d4,#0ea5e9); color:white; border-color: transparent; }
    .chip:hover:not(.active) { border-color: #06b6d4; color: #06b6d4; }
    .stat-card { text-align: center; padding: 1.25rem; }
    .section-title { font-size: 1.6rem; font-weight: 800; margin-bottom: 0.4rem; }
    select.input-glass option { background: #0f172a; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
    .fade-up { animation: fadeUp 0.5s ease forwards; }
    @keyframes pulse-slow { 0%,100%{opacity:1}50%{opacity:0.6} }
    .pulse-slow { animation: pulse-slow 2s ease-in-out infinite; }
  `;
}

export default function App() {
  const auth = useAuth();
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState("home");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (!window.L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      document.head.appendChild(script);
    }
  }, []);

  const nav = (p, dest = null) => { setPage(p); if (dest) setSelected(dest); };
  const bg = dark
    ? { background: "linear-gradient(135deg,#020817,#0f172a,#0c1a2e)", minHeight:"100vh", color:"white" }
    : { background: "linear-gradient(135deg,#e0f2fe,#f0f9ff,#ecfeff)", minHeight:"100vh", color:"#0f172a" };

  if (!auth.user) return <AuthPage auth={auth} dark={dark} setDark={setDark} />;

  return (
    <div style={{ ...bg, fontFamily:"'Sora','DM Sans',sans-serif" }}>
      <style>{globalCSS(dark)}</style>
      <Navbar dark={dark} setDark={setDark} page={page} nav={nav} auth={auth} />
      <main style={{ paddingTop:80, paddingBottom:48, paddingLeft:16, paddingRight:16, maxWidth:1280, margin:"0 auto" }}>
        {page==="home"        && <HomePage        dark={dark} nav={nav} />}
        {page==="search"      && <SearchPage      dark={dark} nav={nav} />}
        {page==="weather"     && <WeatherPage     dark={dark} selected={selected} />}
        {page==="budget"      && <BudgetPage      dark={dark} selected={selected} />}
        {page==="attractions" && <AttractionsPage dark={dark} selected={selected} />}
        {page==="planner"     && <PlannerPage     dark={dark} selected={selected} auth={auth} />}
        {page==="dashboard"   && <DashboardPage   dark={dark} user={auth.user} />}
        {page==="trips"       && <SavedTripsPage  dark={dark} user={auth.user} nav={nav} />}
      </main>
    </div>
  );
}

function Navbar({ dark, setDark, page, nav, auth }) {
  return (
    <nav style={{
      position:"fixed", top:0, left:0, right:0, zIndex:100,
      background: dark ? "rgba(2,8,23,0.85)" : "rgba(240,249,255,0.85)",
      backdropFilter:"blur(20px)",
      borderBottom:`1px solid ${dark?"rgba(6,182,212,0.15)":"rgba(6,182,212,0.2)"}`,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0.85rem 2rem",
    }}>
      <button onClick={()=>nav("home")} style={{ background:"none", border:"none", cursor:"pointer" }}>
        <span className="glow-text" style={{ fontSize:"1.3rem", fontWeight:800, fontFamily:"'Sora',sans-serif" }}>✈ Wanderlux</span>
      </button>
      <div style={{ display:"flex", gap:"0.35rem", alignItems:"center", flexWrap:"wrap" }}>
        {[{id:"search",label:"🔍 Explore"},{id:"dashboard",label:"📊 Dashboard"},{id:"trips",label:"🗺 My Trips"}].map(l=>(
          <button key={l.id} onClick={()=>nav(l.id)} style={{
            background: page===l.id ? "linear-gradient(135deg,#06b6d4,#0ea5e9)" : "transparent",
            border:"none", cursor:"pointer", padding:"0.45rem 0.9rem", borderRadius:10,
            color: page===l.id ? "white" : dark?"rgba(255,255,255,0.65)":"#475569",
            fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:"0.82rem", transition:"all 0.2s",
          }}>{l.label}</button>
        ))}
        <button onClick={()=>setDark(!dark)} style={{
          background:"rgba(6,182,212,0.1)", border:"1px solid rgba(6,182,212,0.25)",
          borderRadius:10, padding:"0.45rem 0.75rem", cursor:"pointer", color:"#06b6d4", fontSize:"1rem",
        }}>{dark?"☀️":"🌙"}</button>
        <button onClick={auth.logout} className="btn-secondary" style={{ padding:"0.45rem 1rem", fontSize:"0.82rem" }}>Sign out</button>
      </div>
    </nav>
  );
}

function AuthPage({ auth, dark, setDark }) {
  const [mode, setMode]   = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const submit = () => {
    const e = mode==="login" ? auth.login(email,pass) : auth.signup(email,pass);
    if (e) setErr(e);
  };
  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background: dark?"linear-gradient(135deg,#020817,#0f172a,#0c1a2e)":"linear-gradient(135deg,#e0f2fe,#f0f9ff,#ecfeff)",
      fontFamily:"'Sora',sans-serif",
    }}>
      <style>{globalCSS(dark)}</style>
      <div className="glass fade-up" style={{ padding:"2.5rem", width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <div className="glow-text" style={{ fontSize:"2.2rem", fontWeight:800, marginBottom:"0.4rem" }}>✈ Wanderlux</div>
          <p style={{ opacity:0.6, fontSize:"0.9rem" }}>Your premium travel companion</p>
        </div>
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.5rem" }}>
          {["login","signup"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} className={mode===m?"btn-primary":"btn-secondary"} style={{ flex:1, textTransform:"capitalize" }}>
              {m==="login"?"Sign In":"Sign Up"}
            </button>
          ))}
        </div>
        {err && <p style={{ color:"#f43f5e", fontSize:"0.82rem", marginBottom:"0.75rem" }}>⚠ {err}</p>}
        <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
          <input className="input-glass" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} type="email" />
          <input className="input-glass" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} type="password" />
          <button className="btn-primary" onClick={submit} style={{ marginTop:"0.25rem" }}>
            {mode==="login"?"Sign In →":"Create Account →"}
          </button>
        </div>
        <p style={{ textAlign:"center", marginTop:"1rem", opacity:0.4, fontSize:"0.78rem" }}>Any email + password works for demo</p>
        <button onClick={()=>setDark(!dark)} style={{ display:"block", margin:"1rem auto 0", background:"none", border:"none", cursor:"pointer", color:"#06b6d4" }}>
          {dark?"☀️ Light":"🌙 Dark"}
        </button>
      </div>
    </div>
  );
}

function HomePage({ dark, nav }) {
  return (
    <div className="fade-up">
      <div style={{ textAlign:"center", padding:"4rem 1rem 3rem", background: dark?"radial-gradient(ellipse at center top,rgba(6,182,212,0.12) 0%,transparent 70%)":"none", borderRadius:24, marginBottom:"3rem" }}>
        <p style={{ color:"#06b6d4", fontWeight:700, fontSize:"0.85rem", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"1rem" }}>✦ Premium Travel Experience</p>
        <h1 style={{ fontSize:"clamp(2.4rem,6vw,4rem)", fontWeight:800, lineHeight:1.1, marginBottom:"1.25rem" }}>
          Discover the World<br/><span className="glow-text">In Style</span>
        </h1>
        <p style={{ opacity:0.65, fontSize:"1.05rem", maxWidth:520, margin:"0 auto 2rem" }}>
          Live weather, budget estimator, interactive maps, and AI-powered itineraries — all in one place.
        </p>
        <div style={{ display:"flex", gap:"1rem", justifyContent:"center", flexWrap:"wrap" }}>
          <button className="btn-primary" onClick={()=>nav("search")} style={{ fontSize:"1rem", padding:"0.8rem 2rem" }}>🔍 Explore Destinations</button>
          <button className="btn-secondary" onClick={()=>nav("planner")} style={{ fontSize:"1rem", padding:"0.8rem 2rem" }}>📋 Plan a Trip</button>
        </div>
      </div>
      <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap", justifyContent:"center", marginBottom:"3rem" }}>
        {["🌤 Live Weather","🗺 Interactive Maps","💰 Budget Estimator","🎯 AI Itinerary","🏛 Attractions","💱 Currency Converter"].map(f=>(
          <span key={f} style={{ padding:"0.4rem 1rem", borderRadius:20, fontSize:"0.82rem", fontWeight:600, background:"rgba(6,182,212,0.1)", border:"1px solid rgba(6,182,212,0.25)", color:"#06b6d4" }}>{f}</span>
        ))}
      </div>
      <h2 className="section-title" style={{ marginBottom:"1.5rem" }}>🔥 Trending Destinations</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"1.25rem" }}>
        {DESTINATIONS.slice(0,4).map(d=><DestCard key={d.city} d={d} nav={nav} />)}
      </div>
    </div>
  );
}

function DestCard({ d, nav }) {
  const budgetColor = { Low:"#10b981", Medium:"#f97316", High:"#f43f5e" };
  const emojis = { Beach:"🏖", Cultural:"🏛", City:"🌆", Adventure:"🏔" };
  return (
    <div className="glass-card" style={{ overflow:"hidden" }}>
      <div style={{ height:160, background:`linear-gradient(135deg,${budgetColor[d.budget]}44,#06b6d444)`, position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:"3.5rem" }}>{emojis[d.type]||"🌍"}</span>
        <div style={{ position:"absolute", top:10, right:10, display:"flex", gap:6 }}>
          <span className="tag" style={{ background:"rgba(0,0,0,0.55)", color:"white" }}>{d.type}</span>
          <span className="tag" style={{ background:budgetColor[d.budget]+"cc", color:"white" }}>{d.budget}</span>
        </div>
        <div style={{ position:"absolute", bottom:10, left:12, background:"rgba(0,0,0,0.6)", borderRadius:8, padding:"0.2rem 0.6rem", color:"white", fontSize:"0.78rem" }}>🌡 {d.tempC}°C</div>
      </div>
      <div style={{ padding:"1rem" }}>
        <h3 style={{ fontWeight:700, fontSize:"1.05rem", marginBottom:"0.2rem" }}>{d.city}</h3>
        <p style={{ opacity:0.6, fontSize:"0.83rem", marginBottom:"0.75rem" }}>📍 {d.country}</p>
        <div style={{ display:"flex", gap:"0.5rem" }}>
          <button className="btn-primary" style={{ flex:1, fontSize:"0.8rem", padding:"0.5rem" }} onClick={()=>nav("weather",d)}>Weather</button>
          <button className="btn-secondary" style={{ flex:1, fontSize:"0.8rem", padding:"0.5rem" }} onClick={()=>nav("planner",d)}>Plan Trip</button>
        </div>
      </div>
    </div>
  );
}

function SearchPage({ dark, nav }) {
  const [query, setQuery]     = useState("");
  const [filterBudget, setFB] = useState("All");
  const [filterType, setFT]   = useState("All");
  const [sortBy, setSort]     = useState("popularity");
  const [page, setPage]       = useState(1);
  const PER_PAGE = 6;
  const debouncedQ = useDebounce(query, 400);

  const filtered = useMemo(() => {
    let list = DESTINATIONS.filter(d => {
      const q = debouncedQ.toLowerCase();
      return (!q || d.city.toLowerCase().includes(q) || d.country.toLowerCase().includes(q))
        && (filterBudget==="All" || d.budget===filterBudget)
        && (filterType==="All" || d.type===filterType);
    });
    if (sortBy==="popularity") list=[...list].sort((a,b)=>b.pop-a.pop);
    if (sortBy==="temp")       list=[...list].sort((a,b)=>b.tempC-a.tempC);
    if (sortBy==="name")       list=[...list].sort((a,b)=>a.city.localeCompare(b.city));
    if (sortBy==="budget_asc") list=[...list].sort((a,b)=>["Low","Medium","High"].indexOf(a.budget)-["Low","Medium","High"].indexOf(b.budget));
    return list;
  }, [debouncedQ, filterBudget, filterType, sortBy]);

  const pages   = Math.ceil(filtered.length/PER_PAGE);
  const visible = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  return (
    <div className="fade-up">
      <h2 className="section-title">🔍 Explore Destinations</h2>
      <p style={{ opacity:0.55, marginBottom:"1.5rem" }}>Find your perfect next adventure</p>
      <div className="glass" style={{ padding:"1.25rem", marginBottom:"1.25rem" }}>
        <input className="input-glass" placeholder="🔍  Search cities or countries…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} />
        <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginTop:"1rem", alignItems:"center" }}>
          <span style={{ opacity:0.5, fontSize:"0.82rem" }}>Budget:</span>
          {["All","Low","Medium","High"].map(b=><button key={b} className={`chip${filterBudget===b?" active":""}`} onClick={()=>{setFB(b);setPage(1);}}>{b}</button>)}
          <span style={{ opacity:0.5, fontSize:"0.82rem", marginLeft:"0.5rem" }}>Type:</span>
          {["All","Beach","Cultural","City","Adventure"].map(t=><button key={t} className={`chip${filterType===t?" active":""}`} onClick={()=>{setFT(t);setPage(1);}}>{t}</button>)}
        </div>
        <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginTop:"0.75rem", alignItems:"center" }}>
          <span style={{ opacity:0.5, fontSize:"0.82rem" }}>Sort:</span>
          {[{v:"popularity",l:"Most Popular"},{v:"temp",l:"Warmest"},{v:"name",l:"A–Z"},{v:"budget_asc",l:"Cheapest"}].map(s=>(
            <button key={s.v} className={`chip${sortBy===s.v?" active":""}`} onClick={()=>setSort(s.v)}>{s.l}</button>
          ))}
        </div>
      </div>
      <p style={{ opacity:0.5, fontSize:"0.82rem", marginBottom:"1rem" }}>{filtered.length} destinations found</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"1.25rem" }}>
        {visible.map(d=>(
          <div key={d.city} className="glass-card" style={{ padding:"1.25rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:"0.75rem" }}>
              <div>
                <h3 style={{ fontWeight:700, fontSize:"1.1rem" }}>{d.city}</h3>
                <p style={{ opacity:0.55, fontSize:"0.83rem" }}>📍 {d.country}</p>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#06b6d4", fontWeight:700 }}>{d.pop}%</div>
                <div style={{ fontSize:"0.8rem", opacity:0.6 }}>🌡 {d.tempC}°C</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:"0.4rem", marginBottom:"1rem" }}>
              <span className="tag" style={{ background:"rgba(6,182,212,0.15)", color:"#06b6d4" }}>{d.type}</span>
              <span className="tag" style={{ background:"rgba(249,115,22,0.15)", color:"#f97316" }}>{d.budget}</span>
            </div>
            <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
              <button className="btn-primary"   style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem" }} onClick={()=>nav("weather",d)}>🌤 Weather</button>
              <button className="btn-secondary" style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem" }} onClick={()=>nav("budget",d)}>💰 Budget</button>
              <button className="btn-secondary" style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem" }} onClick={()=>nav("attractions",d)}>🏛 Explore</button>
              <button className="btn-primary"   style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem" }} onClick={()=>nav("planner",d)}>📋 Plan</button>
            </div>
          </div>
        ))}
      </div>
      {pages>1 && (
        <div style={{ display:"flex", gap:"0.5rem", justifyContent:"center", marginTop:"2rem" }}>
          {Array.from({length:pages},(_,i)=>i+1).map(p=>(
            <button key={p} onClick={()=>setPage(p)} className={page===p?"btn-primary":"btn-secondary"} style={{ width:40, height:40, padding:0 }}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
function WeatherPage({ dark, selected }) {
  const dest = selected || DESTINATIONS[0];
  const forecast = [
    {day:"Mon",temp:dest.tempC+1,rain:20},{day:"Tue",temp:dest.tempC-1,rain:40},
    {day:"Wed",temp:dest.tempC+2,rain:10},{day:"Thu",temp:dest.tempC,rain:55},
    {day:"Fri",temp:dest.tempC+3,rain:5},
  ];
  const countryInfo = {
    France:{currency:"Euro (€)",language:"French",population:"68M",timezone:"UTC+1",capital:"Paris"},
    Indonesia:{currency:"Rupiah (Rp)",language:"Indonesian",population:"275M",timezone:"UTC+8",capital:"Jakarta"},
    Japan:{currency:"Yen (¥)",language:"Japanese",population:"125M",timezone:"UTC+9",capital:"Tokyo"},
    USA:{currency:"Dollar ($)",language:"English",population:"335M",timezone:"UTC-5",capital:"Washington D.C."},
    Greece:{currency:"Euro (€)",language:"Greek",population:"10.7M",timezone:"UTC+2",capital:"Athens"},
    Peru:{currency:"Sol (S/)",language:"Spanish",population:"33M",timezone:"UTC-5",capital:"Lima"},
    UAE:{currency:"Dirham (AED)",language:"Arabic",population:"9.9M",timezone:"UTC+4",capital:"Abu Dhabi"},
    Spain:{currency:"Euro (€)",language:"Spanish",population:"47M",timezone:"UTC+1",capital:"Madrid"},
    "South Africa":{currency:"Rand (R)",language:"Zulu/English",population:"60M",timezone:"UTC+2",capital:"Cape Town"},
    Maldives:{currency:"Rufiyaa (MVR)",language:"Dhivehi",population:"0.5M",timezone:"UTC+5",capital:"Malé"},
    Jordan:{currency:"Dinar (JD)",language:"Arabic",population:"10M",timezone:"UTC+3",capital:"Amman"},
  };
  const info = countryInfo[dest.country] || {currency:"—",language:"—",population:"—",timezone:"—",capital:"—"};
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const scores = months.map((_,i)=>Math.round(60+30*Math.sin((i-3+dest.lat/30)*Math.PI/6)));
  const best = months[scores.indexOf(Math.max(...scores))];
  const packingItems = {
    Beach:["🪪 Passport","🩴 Flip-flops","🩱 Swimsuit","🧴 Sunscreen","🕶 Sunglasses","💊 Medications"],
    Adventure:["🪪 Passport","🥾 Hiking boots","🧤 Gloves","🎒 Daypack","🔦 Flashlight","🦟 Bug spray"],
    Cultural:["🪪 Passport","👗 Smart attire","📷 Camera","🗺 Guidebook","💐 Modest cover-ups","📓 Journal"],
    City:["🪪 Passport","☂ Umbrella","👔 Business casual","🧳 Luggage lock","📋 Travel insurance","🌐 VPN"],
  };
  const packing = packingItems[dest.type] || packingItems.City;

  return (
    <div className="fade-up">
      <h2 className="section-title">🌤 Weather Dashboard</h2>
      <p style={{ opacity:0.55, marginBottom:"1.5rem" }}>{dest.city}, {dest.country}</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:"1rem", marginBottom:"1.5rem" }}>
        {[
          {label:"Temperature",value:`${dest.tempC}°C`,icon:"🌡"},
          {label:"Feels Like",value:`${dest.tempC-2}°C`,icon:"🤔"},
          {label:"Humidity",value:"65%",icon:"💧"},
          {label:"Wind Speed",value:"4.2 m/s",icon:"💨"},
          {label:"Condition",value:"Partly Cloudy",icon:"🌥"},
        ].map(s=>(
          <div key={s.label} className="glass stat-card">
            <div style={{ fontSize:"1.8rem", marginBottom:"0.4rem" }}>{s.icon}</div>
            <div style={{ fontSize:"1.3rem", fontWeight:700, marginBottom:"0.2rem" }}>{s.value}</div>
            <div style={{ opacity:0.55, fontSize:"0.78rem" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem", marginBottom:"1.5rem" }}>
        <div className="glass" style={{ padding:"1.25rem" }}>
          <h3 style={{ fontWeight:700, marginBottom:"1rem" }}>📈 Temperature Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={forecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="day" tick={{ fill:"#94a3b8", fontSize:12 }} />
              <YAxis tick={{ fill:"#94a3b8", fontSize:12 }} unit="°" />
              <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid rgba(6,182,212,0.3)", borderRadius:10 }} />
              <Line type="monotone" dataKey="temp" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill:"#06b6d4" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass" style={{ padding:"1.25rem" }}>
          <h3 style={{ fontWeight:700, marginBottom:"1rem" }}>🌧 Rain Probability</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={forecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="day" tick={{ fill:"#94a3b8", fontSize:12 }} />
              <YAxis tick={{ fill:"#94a3b8", fontSize:12 }} unit="%" />
              <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid rgba(6,182,212,0.3)", borderRadius:10 }} />
              <Bar dataKey="rain" fill="#0ea5e9" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="glass" style={{ padding:"1.5rem", marginBottom:"1.25rem" }}>
        <h3 style={{ fontWeight:700, marginBottom:"1rem" }}>🌍 Country Information</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"1rem" }}>
          {[
            {label:"💱 Currency",value:info.currency},
            {label:"🗣 Language",value:info.language},
            {label:"👥 Population",value:info.population},
            {label:"⏰ Timezone",value:info.timezone},
            {label:"🏙 Capital",value:info.capital},
          ].map(i=>(
            <div key={i.label} style={{ padding:"0.85rem", background:"rgba(6,182,212,0.07)", borderRadius:12, border:"1px solid rgba(6,182,212,0.12)" }}>
              <div style={{ opacity:0.55, fontSize:"0.78rem", marginBottom:"0.3rem" }}>{i.label}</div>
              <div style={{ fontWeight:600, fontSize:"0.92rem" }}>{i.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>
        <div className="glass" style={{ padding:"1.25rem" }}>
          <h3 style={{ fontWeight:700, marginBottom:"0.5rem" }}>🗓 Best Time to Visit</h3>
          <p style={{ color:"#06b6d4", fontWeight:700, fontSize:"1.2rem", marginBottom:"0.75rem" }}>{best} – {months[(months.indexOf(best)+2)%12]}</p>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {months.map((m,i)=>(
              <div key={m} style={{ width:36, textAlign:"center", fontSize:"0.7rem" }}>
                <div style={{ height:Math.round(scores[i]/10), background:scores[i]>80?"#06b6d4":"rgba(6,182,212,0.3)", borderRadius:"2px 2px 0 0", marginBottom:2 }} />
                {m}
              </div>
            ))}
          </div>
        </div>
        <div className="glass" style={{ padding:"1.25rem" }}>
          <h3 style={{ fontWeight:700, marginBottom:"0.75rem" }}>🎒 Packing Checklist</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.35rem" }}>
            {packing.map(i=>(
              <label key={i} style={{ display:"flex", alignItems:"center", gap:"0.5rem", cursor:"pointer", fontSize:"0.88rem" }}>
                <input type="checkbox" style={{ accentColor:"#06b6d4" }} /> {i}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetPage({ selected }) {
  const destination = selected || { lat: 0, lon: 0, city: "Unknown" };

  const [days, setDays] = useState(7);
  const [hotel, setHotel] = useState("Mid");
  const [food, setFood] = useState("Restaurant");
  const [acts, setActs] = useState("Cultural");
  const [curr, setCurr] = useState("USD");

  const RATES = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149, INR: 83, AED: 3.67 };

  const HOTEL_COSTS = { Budget: 50, Mid: 100, Luxury: 200 };
  const FOOD_COSTS = { Street: 20, Restaurant: 50, Fine: 100 };
  const ACTIVITY_COSTS = { Cultural: 30, Adventure: 70, Luxury: 150 };

  const hotelTotal = HOTEL_COSTS[hotel] * days;
  const foodTotal = FOOD_COSTS[food] * days;
  const actTotal = ACTIVITY_COSTS[acts] * days;

  const flights = 400 + Math.abs(destination.lat - destination.lon) * 0.5;

  const misc = Math.round((hotelTotal + foodTotal + actTotal) * 0.1);
  const total = hotelTotal + foodTotal + actTotal + flights + misc;

  const rate = RATES[curr] || 1;
  const fmt = (n) => (n * rate).toFixed(curr === "JPY" ? 0 : 2);

  const pieData = [
    { name: "Hotel", value: hotelTotal },
    { name: "Food", value: foodTotal },
    { name: "Activities", value: actTotal },
    { name: "Flights", value: flights },
    { name: "Misc", value: misc },
  ];

  return (
    <div className="fade-up">
      <h2 className="section-title">💰 Budget Estimator</h2>
      <p style={{ opacity: 0.6, marginBottom: "1rem" }}>
        {destination.city}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        
        {/* LEFT SIDE */}
        <div className="glass" style={{ padding: "1.5rem" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "1.25rem" }}>Trip Details</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            
            {/* Days */}
            <div>
              <label>Days: <strong>{days}</strong></label>
              <input
                type="range"
                min={1}
                max={30}
                value={days}
                onChange={(e) => setDays(+e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* Hotel */}
            <div>
              <label>Hotel Type</label>
              <select className="input-glass" value={hotel} onChange={(e) => setHotel(e.target.value)}>
                <option>Budget</option>
                <option>Mid</option>
                <option>Luxury</option>
              </select>
            </div>

            {/* Food */}
            <div>
              <label>Food Style</label>
              <select className="input-glass" value={food} onChange={(e) => setFood(e.target.value)}>
                <option>Street</option>
                <option>Restaurant</option>
                <option>Fine</option>
              </select>
            </div>

            {/* Activities */}
            <div>
              <label>Activities</label>
              <select className="input-glass" value={acts} onChange={(e) => setActs(e.target.value)}>
                <option>Cultural</option>
                <option>Adventure</option>
                <option>Luxury</option>
              </select>
            </div>

            {/* Currency */}
            <div>
              <label>Currency</label>
              <select className="input-glass" value={curr} onChange={(e) => setCurr(e.target.value)}>
                {Object.keys(RATES).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* RIGHT SIDE */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          <div className="glass" style={{ padding: "1.5rem", textAlign: "center" }}>
            <p style={{ opacity: 0.55 }}>Total Budget</p>
            <h2 style={{ fontSize: "2rem", fontWeight: 800 }}>
              {curr} {fmt(total)}
            </h2>
            <p style={{ opacity: 0.5 }}>For {days} days</p>
          </div>

          <div className="glass" style={{ padding: "1rem" }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" outerRadius={80}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${curr} ${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

        </div>
      </div>
    </div>
  );
}
 

function AttractionsPage({ dark, selected }) {
  const dest = selected || DESTINATIONS[0];
  const mapRef = useRef(null);
  const attractions = MOCK_ATTRACTIONS[dest.city] || MOCK_ATTRACTIONS.default;
  const [page, setPage] = useState(1);
  const photos = useMemo(()=>Array.from({length:page*6},(_,i)=>({
    id:i,
    url:`https://picsum.photos/seed/${dest.city}${i}/600/400`,
    caption: attractions[i%attractions.length]?.name || dest.city,
  })),[dest.city, page]);
  useLeaflet(mapRef, dest.lat, dest.lon, attractions);
  return (
    <div className="fade-up">
      <h2 className="section-title">🏛 Attractions Explorer</h2>
      <p style={{ opacity:0.55, marginBottom:"1.5rem" }}>{dest.city}, {dest.country}</p>
      <div className="glass" style={{ padding:"1rem", marginBottom:"1.5rem" }}>
        <h3 style={{ fontWeight:700, marginBottom:"0.75rem" }}>🗺 Interactive Map</h3>
        <div ref={mapRef} style={{ height:350, borderRadius:14, overflow:"hidden", background:"#1e293b" }} />
      </div>
      <div className="glass" style={{ padding:"1.25rem", marginBottom:"1.5rem" }}>
        <h3 style={{ fontWeight:700, marginBottom:"0.75rem" }}>📍 Top Attractions</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>
          {attractions.map((a,i)=>(
            <div key={a.name} style={{ display:"flex", alignItems:"center", gap:"1rem", padding:"0.75rem 1rem", background:"rgba(6,182,212,0.07)", borderRadius:12 }}>
              <span style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#06b6d4,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:"0.85rem", flexShrink:0 }}>{i+1}</span>
              <span style={{ fontWeight:600 }}>{a.name}</span>
            </div>
          ))}
        </div>
      </div>
      <h3 style={{ fontWeight:700, marginBottom:"1rem" }}>📸 Photo Gallery</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"1rem" }}>
        {photos.map(p=>(
          <div key={p.id} className="glass-card" style={{ overflow:"hidden" }}>
            <img src={p.url} alt={p.caption} style={{ width:"100%", height:200, objectFit:"cover", display:"block" }} loading="lazy" />
            <div style={{ padding:"0.65rem 0.85rem", fontSize:"0.78rem", opacity:0.6 }}>📷 {p.caption}</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign:"center", marginTop:"1.5rem" }}>
        <button className="btn-secondary" onClick={()=>setPage(p=>p+1)}>⬇ Load More Photos</button>
      </div>
    </div>
  );
}

function PlannerPage({ dark, selected, auth }) {
  const [step, setStep] = useState(0);
  const [dest, setDest] = useState(selected?.city || "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [budget, setBudget] = useState("Medium");
  const [acts, setActs] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const actOptions = ["Beach", "Hiking", "Food Tour", "Museum"];

  const STEPS = ["Destination", "Dates", "Activities", "Generate"];

  const days = useMemo(() => {
    if (!start || !end) return 0;
    return Math.max(
      1,
      Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24))
    );
  }, [start, end]);

  const toggleAct = (a) => {
    setActs((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  const fallbackPlan = () => {
    return `🌍 Your ${days || 7}-Day ${dest || "Paris"} Adventure Plan\n
Day 1: Arrival & Local Exploration
Day 2: Sightseeing & Food Tour
Day 3: Activities & Relaxation
Enjoy your trip! ✈️`;
  };

  const generate = async () => {
    setLoading(true);
    setStep(3);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "YOUR_API_KEY",
        },
        body: JSON.stringify({
          prompt: `Create a ${days || 7}-day itinerary for ${dest}`,
        }),
      });

      const data = await res.json();

      setPlan(
        data?.content?.map((b) => b?.text || "").join("") || fallbackPlan()
      );
    } catch (e) {
      setPlan(fallbackPlan());
    }

    setLoading(false);
  };

  const savePlan = () => {
    auth.saveTrip({
  dest,
  start,
  end,
  budget,
  acts,
  plan,
});
  };

  return (
    <div className="fade-up">
      <h2 className="section-title">🧾 Itinerary Planner</h2>

      {/* Steps */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
        {STEPS.map((s, i) => (
          <div key={i}>{s}</div>
        ))}
      </div>

      {/* Step 0 */}
      {step === 0 && (
        <div>
          <h3>📍 Where to?</h3>
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="Enter destination"
          />
          <button onClick={() => setStep(1)}>Next</button>
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div>
          <input type="date" onChange={(e) => setStart(e.target.value)} />
          <input type="date" onChange={(e) => setEnd(e.target.value)} />
          <button onClick={() => setStep(2)}>Next</button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div>
          {actOptions.map((a) => (
            <button key={a} onClick={() => toggleAct(a)}>
              {a}
            </button>
          ))}
          <button onClick={generate}>Generate</button>
        </div>
      )}

      {/* Result */}
      {step === 3 && (
        <div>
          {loading ? <p>Loading...</p> : <pre>{plan}</pre>}
          {!saved && <button onClick={savePlan}>Save</button>}
        </div>
      )}
    </div>
  );
}
function DashboardPage() {
  return <h1>Dashboard Page</h1>;
}

function SavedTripsPage() {
  return <h1>Saved Trips Page</h1>;
}