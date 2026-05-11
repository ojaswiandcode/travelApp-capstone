import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const OPENWEATHER_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_KEY;

const DESTINATIONS = [
  { city:"Paris",        country:"France",       lat:48.8566,  lon:2.3522,   type:"Cultural",  budget:"High",   tempC:14, pop:95 },
  { city:"Bali",         country:"Indonesia",    lat:-8.3405,  lon:115.092,  type:"Beach",     budget:"Low",    tempC:28, pop:92 },
  { city:"Tokyo",        country:"Japan",        lat:35.6762,  lon:139.6503, type:"Cultural",  budget:"Medium", tempC:16, pop:97 },
  { city:"New York",     country:"USA",          lat:40.7128,  lon:-74.006,  type:"City",      budget:"High",   tempC:13, pop:98 },
  { city:"Santorini",    country:"Greece",       lat:36.3932,  lon:25.4615,  type:"Beach",     budget:"High",   tempC:22, pop:88 },
  { city:"Machu Picchu", country:"Peru",         lat:-13.1631, lon:-72.545,  type:"Adventure", budget:"Medium", tempC:12, pop:85 },
  { city:"Dubai",        country:"UAE",          lat:25.2048,  lon:55.2708,  type:"City",      budget:"High",   tempC:30, pop:90 },
  { city:"Barcelona",    country:"Spain",        lat:41.3851,  lon:2.1734,   type:"Cultural",  budget:"Medium", tempC:18, pop:91 },
  { city:"Cape Town",    country:"South Africa", lat:-33.9249, lon:18.4241,  type:"Adventure", budget:"Medium", tempC:17, pop:83 },
  { city:"Kyoto",        country:"Japan",        lat:35.0116,  lon:135.7681, type:"Cultural",  budget:"Medium", tempC:15, pop:87 },
  { city:"Maldives",     country:"Maldives",     lat:3.2028,   lon:73.2207,  type:"Beach",     budget:"High",   tempC:29, pop:86 },
  { city:"Petra",        country:"Jordan",       lat:30.3285,  lon:35.4444,  type:"Adventure", budget:"Medium", tempC:20, pop:80 },
];

const MOCK_ATTRACTIONS = {
  Paris:     [{ name:"Eiffel Tower",lat:48.8584,lon:2.2945 },{ name:"Louvre",lat:48.8606,lon:2.3376 },{ name:"Notre-Dame",lat:48.853,lon:2.3499 }],
  Tokyo:     [{ name:"Shibuya Crossing",lat:35.6595,lon:139.7004 },{ name:"Senso-ji",lat:35.7148,lon:139.7967 },{ name:"Shinjuku",lat:35.6938,lon:139.7036 }],
  Bali:      [{ name:"Ubud Palace",lat:-8.5069,lon:115.2625 },{ name:"Tanah Lot",lat:-8.6214,lon:115.0868 },{ name:"Kuta Beach",lat:-8.7185,lon:115.1686 }],
  Barcelona: [{ name:"Sagrada Família",lat:41.4036,lon:2.1744 },{ name:"Park Güell",lat:41.4145,lon:2.1527 },{ name:"Las Ramblas",lat:41.3797,lon:2.174 }],
  default:   [{ name:"City Center",lat:0,lon:0 }],
};

const HOTEL_COSTS    = { Budget:30, Mid:80, Luxury:250 };
const FOOD_COSTS     = { Street:15, Restaurant:40, Fine:100 };
const ACTIVITY_COSTS = { Adventure:60, Relaxation:30, Cultural:25, Beach:10 };
const PIE_COLORS     = ["#06b6d4","#f97316","#8b5cf6","#10b981","#f43f5e"];
const STEPS          = ["Destination","Dates","Budget","Activities","Generate"];
const BUDGET_COLOR   = { Low:"#10b981", Medium:"#f97316", High:"#f43f5e" };
const EMOJIS         = { Beach:"🏖", Cultural:"🏛", City:"🌆", Adventure:"🏔" };

// ── HOOKS ─────────────────────────────────────────────────────────────────────
function useDebounce(value, delay=500) {
  const [deb,setDeb] = useState(value);
  useEffect(()=>{ const t=setTimeout(()=>setDeb(value),delay); return ()=>clearTimeout(t); },[value,delay]);
  return deb;
}

function useUnsplash(city) {
  const [img,setImg] = useState(null);
  useEffect(()=>{
    if(!UNSPLASH_KEY) return;
    fetch(`https://api.unsplash.com/photos/random?query=${city}+travel&client_id=${UNSPLASH_KEY}`)
      .then(r=>r.json()).then(j=>{ if(j?.urls?.regular) setImg(j.urls.regular); }).catch(()=>{});
  },[city]);
  return img;
}

function useLeaflet(mapRef,lat,lon,attractions) {
  useEffect(()=>{
    if(!mapRef.current||!window.L) return;
    const L=window.L;
    mapRef.current.innerHTML="";
    const map=L.map(mapRef.current).setView([lat,lon],12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);
    L.marker([lat,lon]).addTo(map).bindPopup("📍 City Center").openPopup();
    attractions.forEach(a=>{ if(a.lat&&a.lon) L.marker([a.lat,a.lon]).addTo(map).bindPopup(`🏛 ${a.name}`); });
    return ()=>map.remove();
  },[lat,lon,attractions]);
}

function useAuth() {
  const [user,setUser]=useState(()=>{ try{ return JSON.parse(localStorage.getItem("travel_user")); }catch{ return null; } });
  const login=(email,pass)=>{
    if(!email||!pass) return "Fill all fields";
    const u={email,name:email.split("@")[0],savedTrips:[]};
    localStorage.setItem("travel_user",JSON.stringify(u)); setUser(u); return null;
  };
  const logout=()=>{ localStorage.removeItem("travel_user"); setUser(null); };
  const saveTrip=(trip)=>{
    setUser(u=>{ const next={...u,savedTrips:[...(u.savedTrips||[]),trip]}; localStorage.setItem("travel_user",JSON.stringify(next)); return next; });
  };
  return {user,login,signup:login,logout,saveTrip};
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const css=(dark)=>`
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#06b6d4;border-radius:3px}
  body{font-family:'Sora',sans-serif;}
  .glass{background:${dark?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.65)"};backdrop-filter:blur(16px);border:1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.8)"};border-radius:20px;}
  .card{background:${dark?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.7)"};backdrop-filter:blur(12px);border:1px solid ${dark?"rgba(6,182,212,0.2)":"rgba(6,182,212,0.25)"};border-radius:16px;transition:transform 0.2s,box-shadow 0.2s;}
  .card:hover{transform:translateY(-4px);box-shadow:0 20px 60px rgba(6,182,212,0.15);}
  .btn{background:linear-gradient(135deg,#06b6d4,#0ea5e9);color:white;border:none;cursor:pointer;font-weight:600;border-radius:12px;padding:0.65rem 1.5rem;transition:all 0.2s;font-family:'Sora',sans-serif;}
  .btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(6,182,212,0.4);}
  .btn2{background:transparent;border:1px solid ${dark?"rgba(6,182,212,0.4)":"rgba(6,182,212,0.6)"};color:#06b6d4;cursor:pointer;font-weight:600;border-radius:12px;padding:0.65rem 1.5rem;transition:all 0.2s;font-family:'Sora',sans-serif;}
  .btn2:hover{background:rgba(6,182,212,0.1);}
  .inp{background:${dark?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.8)"};border:1px solid ${dark?"rgba(6,182,212,0.25)":"rgba(6,182,212,0.35)"};border-radius:12px;padding:0.7rem 1rem;width:100%;color:${dark?"white":"#0f172a"};outline:none;font-family:'Sora',sans-serif;font-size:0.9rem;}
  .inp:focus{border-color:#06b6d4;box-shadow:0 0 0 3px rgba(6,182,212,0.1);}
  .inp::placeholder{color:${dark?"rgba(255,255,255,0.3)":"rgba(0,0,0,0.35)"};}
  .glow{background:linear-gradient(135deg,#06b6d4,#38bdf8,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
  .chip{padding:0.35rem 0.9rem;border-radius:20px;border:1px solid rgba(6,182,212,0.35);cursor:pointer;font-size:0.82rem;font-weight:500;transition:all 0.2s;background:transparent;color:${dark?"white":"#0f172a"};}
  .chip.on{background:linear-gradient(135deg,#06b6d4,#0ea5e9);color:white;border-color:transparent;}
  .chip:hover:not(.on){border-color:#06b6d4;color:#06b6d4;}
  .tag{display:inline-block;padding:0.2rem 0.65rem;border-radius:20px;font-size:0.72rem;font-weight:600;}
  select.inp option{background:#0f172a;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  .up{animation:fadeUp 0.5s ease forwards;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
  .pulse{animation:pulse 2s ease-in-out infinite;}
`;

// ── DEST CARD (top level — NOT inside any function) ───────────────────────────
function DestCard({ d, nav }) {
  const img = useUnsplash(d.city);
  return (
    <div className="card" style={{ overflow:"hidden" }}>
      <div style={{
        height:160, position:"relative", display:"flex", alignItems:"center", justifyContent:"center",
        background: img ? `url(${img}) center/cover no-repeat` : `linear-gradient(135deg,${BUDGET_COLOR[d.budget]}44,#06b6d444)`,
      }}>
        {!img && <span style={{ fontSize:"3.5rem" }}>{EMOJIS[d.type]||"🌍"}</span>}
        <div style={{ position:"absolute", top:10, right:10, display:"flex", gap:6 }}>
          <span className="tag" style={{ background:"rgba(0,0,0,0.55)", color:"white" }}>{d.type}</span>
          <span className="tag" style={{ background:BUDGET_COLOR[d.budget]+"cc", color:"white" }}>{d.budget}</span>
        </div>
        <div style={{ position:"absolute", bottom:10, left:12, background:"rgba(0,0,0,0.6)", borderRadius:8, padding:"0.2rem 0.6rem", color:"white", fontSize:"0.78rem" }}>
          🌡 {d.tempC}°C
        </div>
      </div>
      <div style={{ padding:"1rem" }}>
        <h3 style={{ fontWeight:700, fontSize:"1.05rem", marginBottom:"0.2rem" }}>{d.city}</h3>
        <p style={{ opacity:0.6, fontSize:"0.83rem", marginBottom:"0.75rem" }}>📍 {d.country}</p>
        <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
          <button className="btn"  style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem" }} onClick={()=>nav("weather",d)}>🌤 Weather</button>
          <button className="btn2" style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem" }} onClick={()=>nav("budget",d)}>💰 Budget</button>
          <button className="btn2" style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem" }} onClick={()=>nav("attractions",d)}>🏛 Explore</button>
          <button className="btn"  style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem" }} onClick={()=>nav("planner",d)}>📋 Plan</button>
        </div>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const auth=useAuth();
  const [dark,setDark]=useState(true);
  const [page,setPage]=useState("home");
  const [selected,setSelected]=useState(null);

  useEffect(()=>{
    if(!document.getElementById("lcss")){
      const l=document.createElement("link"); l.id="lcss"; l.rel="stylesheet";
      l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(l);
    }
    if(!window.L){
      const s=document.createElement("script");
      s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; document.head.appendChild(s);
    }
  },[]);

  const nav=(p,dest=null)=>{ setPage(p); if(dest) setSelected(dest); };
  const bg=dark
    ?{background:"linear-gradient(135deg,#020817,#0f172a,#0c1a2e)",minHeight:"100vh",color:"white"}
    :{background:"linear-gradient(135deg,#e0f2fe,#f0f9ff,#ecfeff)",minHeight:"100vh",color:"#0f172a"};

  if(!auth.user) return <Auth auth={auth} dark={dark} setDark={setDark}/>;

  return (
    <div style={{...bg,fontFamily:"'Sora',sans-serif"}}>
      <style>{css(dark)}</style>
      <Nav dark={dark} setDark={setDark} page={page} nav={nav} auth={auth}/>
      <main style={{paddingTop:80,paddingBottom:48,padding:"80px 24px 48px",maxWidth:1280,margin:"0 auto"}}>
        {page==="home"        && <Home        dark={dark} nav={nav}/>}
        {page==="search"      && <Search      dark={dark} nav={nav}/>}
        {page==="weather"     && <Weather     dark={dark} selected={selected}/>}
        {page==="budget"      && <Budget      dark={dark} selected={selected}/>}
        {page==="attractions" && <Attractions dark={dark} selected={selected}/>}
        {page==="planner"     && <Planner     dark={dark} selected={selected} auth={auth}/>}
        {page==="dashboard"   && <Dashboard   dark={dark} user={auth.user}/>}
        {page==="trips"       && <Trips       dark={dark} user={auth.user} nav={nav}/>}
      </main>
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────────────────────────
function Nav({dark,setDark,page,nav,auth}) {
  return (
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,background:dark?"rgba(2,8,23,0.9)":"rgba(240,249,255,0.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${dark?"rgba(6,182,212,0.15)":"rgba(6,182,212,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.85rem 2rem"}}>
      <button onClick={()=>nav("home")} style={{background:"none",border:"none",cursor:"pointer"}}>
        <span className="glow" style={{fontSize:"1.3rem",fontWeight:800}}>✈ Wanderlux</span>
      </button>
      <div style={{display:"flex",gap:"0.35rem",alignItems:"center",flexWrap:"wrap"}}>
        {[{id:"search",label:"🔍 Explore"},{id:"dashboard",label:"📊 Dashboard"},{id:"trips",label:"🗺 My Trips"}].map(l=>(
          <button key={l.id} onClick={()=>nav(l.id)} style={{background:page===l.id?"linear-gradient(135deg,#06b6d4,#0ea5e9)":"transparent",border:"none",cursor:"pointer",padding:"0.45rem 0.9rem",borderRadius:10,color:page===l.id?"white":dark?"rgba(255,255,255,0.65)":"#475569",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:"0.82rem",transition:"all 0.2s"}}>{l.label}</button>
        ))}
        <button onClick={()=>setDark(!dark)} style={{background:"rgba(6,182,212,0.1)",border:"1px solid rgba(6,182,212,0.25)",borderRadius:10,padding:"0.45rem 0.75rem",cursor:"pointer",color:"#06b6d4",fontSize:"1rem"}}>{dark?"☀️":"🌙"}</button>
        <button onClick={auth.logout} className="btn2" style={{padding:"0.45rem 1rem",fontSize:"0.82rem"}}>Sign out</button>
      </div>
    </nav>
  );
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function Auth({auth,dark,setDark}) {
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const submit=()=>{ const e=auth.login(email,pass); if(e) setErr(e); };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:dark?"linear-gradient(135deg,#020817,#0f172a)":"linear-gradient(135deg,#e0f2fe,#f0f9ff)",fontFamily:"'Sora',sans-serif"}}>
      <style>{css(dark)}</style>
      <div className="glass up" style={{padding:"2.5rem",width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div className="glow" style={{fontSize:"2.2rem",fontWeight:800,marginBottom:"0.4rem"}}>✈ Wanderlux</div>
          <p style={{opacity:0.6,fontSize:"0.9rem"}}>Your premium travel companion</p>
        </div>
        <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.5rem"}}>
          {["login","signup"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} className={mode===m?"btn":"btn2"} style={{flex:1}}>{m==="login"?"Sign In":"Sign Up"}</button>
          ))}
        </div>
        {err&&<p style={{color:"#f43f5e",fontSize:"0.82rem",marginBottom:"0.75rem"}}>⚠ {err}</p>}
        <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          <input className="inp" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} type="email"/>
          <input className="inp" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} type="password"/>
          <button className="btn" onClick={submit} style={{marginTop:"0.25rem"}}>{mode==="login"?"Sign In →":"Create Account →"}</button>
        </div>
        <p style={{textAlign:"center",marginTop:"1rem",opacity:0.4,fontSize:"0.78rem"}}>Any email + password works for demo</p>
        <button onClick={()=>setDark(!dark)} style={{display:"block",margin:"1rem auto 0",background:"none",border:"none",cursor:"pointer",color:"#06b6d4"}}>{dark?"☀️ Light":"🌙 Dark"}</button>
      </div>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function Home({dark,nav}) {
  return (
    <div className="up">
      <div style={{textAlign:"center",padding:"4rem 1rem 3rem",background:dark?"radial-gradient(ellipse at top,rgba(6,182,212,0.12),transparent 70%)":"none",borderRadius:24,marginBottom:"3rem"}}>
        <p style={{color:"#06b6d4",fontWeight:700,fontSize:"0.85rem",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:"1rem"}}>✦ Premium Travel Experience</p>
        <h1 style={{fontSize:"clamp(2.4rem,6vw,4rem)",fontWeight:800,lineHeight:1.1,marginBottom:"1.25rem"}}>
          Discover the World<br/><span className="glow">In Style</span>
        </h1>
        <p style={{opacity:0.65,fontSize:"1.05rem",maxWidth:520,margin:"0 auto 2rem"}}>Live weather, budget estimator, interactive maps, and AI-powered itineraries — all in one place.</p>
        <div style={{display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
          <button className="btn" onClick={()=>nav("search")} style={{fontSize:"1rem",padding:"0.8rem 2rem"}}>🔍 Explore Destinations</button>
          <button className="btn2" onClick={()=>nav("planner")} style={{fontSize:"1rem",padding:"0.8rem 2rem"}}>📋 Plan a Trip</button>
        </div>
      </div>
      <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap",justifyContent:"center",marginBottom:"3rem"}}>
        {["🌤 Live Weather","🗺 Interactive Maps","💰 Budget Estimator","🎯 AI Itinerary","🏛 Attractions","💱 Currency Converter"].map(f=>(
          <span key={f} style={{padding:"0.4rem 1rem",borderRadius:20,fontSize:"0.82rem",fontWeight:600,background:"rgba(6,182,212,0.1)",border:"1px solid rgba(6,182,212,0.25)",color:"#06b6d4"}}>{f}</span>
        ))}
      </div>
      <h2 style={{fontSize:"1.6rem",fontWeight:800,marginBottom:"1.5rem"}}>🔥 Trending Destinations</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"1.25rem"}}>
        {DESTINATIONS.slice(0,4).map(d=><DestCard key={d.city} d={d} nav={nav}/>)}
      </div>
    </div>
  );
}

// ── SEARCH ────────────────────────────────────────────────────────────────────
function Search({dark,nav}) {
  const [query,setQuery]=useState("");
  const [fb,setFb]=useState("All");
  const [ft,setFt]=useState("All");
  const [sort,setSort]=useState("popularity");
  const [pg,setPg]=useState(1);
  const PER=6;
  const q=useDebounce(query,400);

  const filtered=useMemo(()=>{
    const s=q.toLowerCase();
    let l=DESTINATIONS.filter(d=>
      (!s||d.city.toLowerCase().includes(s)||d.country.toLowerCase().includes(s))&&
      (fb==="All"||d.budget===fb)&&(ft==="All"||d.type===ft)
    );
    if(sort==="popularity") l=[...l].sort((a,b)=>b.pop-a.pop);
    if(sort==="temp")       l=[...l].sort((a,b)=>b.tempC-a.tempC);
    if(sort==="name")       l=[...l].sort((a,b)=>a.city.localeCompare(b.city));
    if(sort==="cheap")      l=[...l].sort((a,b)=>["Low","Medium","High"].indexOf(a.budget)-["Low","Medium","High"].indexOf(b.budget));
    return l;
  },[q,fb,ft,sort]);

  const pages=Math.ceil(filtered.length/PER);
  const visible=filtered.slice((pg-1)*PER,pg*PER);

  return (
    <div className="up">
      <h2 style={{fontSize:"1.6rem",fontWeight:800,marginBottom:"0.4rem"}}>🔍 Explore Destinations</h2>
      <p style={{opacity:0.55,marginBottom:"1.5rem"}}>Find your perfect next adventure</p>
      <div className="glass" style={{padding:"1.25rem",marginBottom:"1.25rem"}}>
        <input className="inp" placeholder="🔍  Search cities or countries…" value={query} onChange={e=>{setQuery(e.target.value);setPg(1);}}/>
        <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginTop:"1rem",alignItems:"center"}}>
          <span style={{opacity:0.5,fontSize:"0.82rem"}}>Budget:</span>
          {["All","Low","Medium","High"].map(b=><button key={b} className={`chip${fb===b?" on":""}`} onClick={()=>{setFb(b);setPg(1);}}>{b}</button>)}
          <span style={{opacity:0.5,fontSize:"0.82rem",marginLeft:"0.5rem"}}>Type:</span>
          {["All","Beach","Cultural","City","Adventure"].map(t=><button key={t} className={`chip${ft===t?" on":""}`} onClick={()=>{setFt(t);setPg(1);}}>{t}</button>)}
        </div>
        <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginTop:"0.75rem",alignItems:"center"}}>
          <span style={{opacity:0.5,fontSize:"0.82rem"}}>Sort:</span>
          {[{v:"popularity",l:"Most Popular"},{v:"temp",l:"Warmest"},{v:"name",l:"A–Z"},{v:"cheap",l:"Cheapest"}].map(s=>(
            <button key={s.v} className={`chip${sort===s.v?" on":""}`} onClick={()=>setSort(s.v)}>{s.l}</button>
          ))}
        </div>
      </div>
      <p style={{opacity:0.5,fontSize:"0.82rem",marginBottom:"1rem"}}>{filtered.length} destinations found</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"1.25rem"}}>
        {visible.map(d=><DestCard key={d.city} d={d} nav={nav}/>)}
      </div>
      {pages>1&&(
        <div style={{display:"flex",gap:"0.5rem",justifyContent:"center",marginTop:"2rem"}}>
          {Array.from({length:pages},(_,i)=>i+1).map(p=>(
            <button key={p} onClick={()=>setPg(p)} className={pg===p?"btn":"btn2"} style={{width:40,height:40,padding:0}}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── WEATHER ───────────────────────────────────────────────────────────────────
function Weather({dark,selected}) {
  const dest=selected||DESTINATIONS[0];
  const [weather,setWeather]=useState(null);
  const [forecast,setForecast]=useState([]);
  const [country,setCountry]=useState(null);
  const [loading,setLoading]=useState(true);
  const [last,setLast]=useState(Date.now());
  const tt={contentStyle:{background:"#0f172a",border:"1px solid rgba(6,182,212,0.3)",borderRadius:10}};

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const w=await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${dest.city}&appid=${OPENWEATHER_KEY}&units=metric`).then(r=>r.json());
      setWeather(w.cod===200?w:{main:{temp:dest.tempC,humidity:65,feels_like:dest.tempC-2},wind:{speed:4.2},weather:[{description:"Partly cloudy"}]});
      const f=await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${dest.city}&appid=${OPENWEATHER_KEY}&units=metric&cnt=40`).then(r=>r.json());
      if(f.list){
        const seen=new Set(),daily=[];
        for(const item of f.list){ const day=item.dt_txt.split(" ")[0]; if(!seen.has(day)){seen.add(day);daily.push(item);} if(daily.length>=5)break; }
        setForecast(daily.map(d=>({day:new Date(d.dt*1000).toLocaleDateString("en",{weekday:"short"}),temp:Math.round(d.main.temp),rain:Math.round((d.pop||0)*100)})));
      } else {
        setForecast([{day:"Mon",temp:dest.tempC+1,rain:20},{day:"Tue",temp:dest.tempC-1,rain:40},{day:"Wed",temp:dest.tempC+2,rain:10},{day:"Thu",temp:dest.tempC,rain:55},{day:"Fri",temp:dest.tempC+3,rain:5}]);
      }
      const c=await fetch(`https://restcountries.com/v3.1/name/${dest.country}?fields=name,currencies,languages,population,timezones,capital`).then(r=>r.json());
      if(Array.isArray(c)) setCountry(c[0]);
    }catch{
      setWeather({main:{temp:dest.tempC,humidity:65,feels_like:dest.tempC-2},wind:{speed:4.2},weather:[{description:"Partly cloudy"}]});
      setForecast([{day:"Mon",temp:dest.tempC+1,rain:20},{day:"Tue",temp:dest.tempC-1,rain:40},{day:"Wed",temp:dest.tempC+2,rain:10},{day:"Thu",temp:dest.tempC,rain:55},{day:"Fri",temp:dest.tempC+3,rain:5}]);
    }
    setLoading(false); setLast(Date.now());
  },[dest]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{ const t=setInterval(load,60000); return ()=>clearInterval(t); },[load]);

  const packing={Beach:["🪪 Passport","🩴 Flip-flops","🩱 Swimsuit","🧴 Sunscreen","🕶 Sunglasses","💊 Medications"],Adventure:["🪪 Passport","🥾 Hiking boots","🧤 Gloves","🎒 Daypack","🔦 Flashlight","🦟 Bug spray"],Cultural:["🪪 Passport","👗 Smart attire","📷 Camera","🗺 Guidebook","💐 Cover-ups","📓 Journal"],City:["🪪 Passport","☂ Umbrella","👔 Smart casual","🧳 Lock","📋 Insurance","🌐 VPN"]};
  const pack=packing[dest.type]||packing.City;
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const scores=months.map((_,i)=>Math.round(60+30*Math.sin((i-3+dest.lat/30)*Math.PI/6)));
  const best=months[scores.indexOf(Math.max(...scores))];
  const currencies=country?Object.values(country.currencies||{}).map(c=>`${c.name} (${c.symbol})`).join(", "):"—";
  const languages=country?Object.values(country.languages||{}).join(", "):"—";

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300}}><span className="pulse" style={{fontSize:"3rem"}}>✈️</span></div>;

  return (
    <div className="up">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem",flexWrap:"wrap",gap:"0.75rem"}}>
        <div><h2 style={{fontSize:"1.6rem",fontWeight:800}}>🌤 Weather Dashboard</h2><p style={{opacity:0.55}}>{dest.city}, {dest.country}</p></div>
        <button className="btn2" onClick={load} style={{fontSize:"0.82rem"}}>🔄 Refresh · {new Date(last).toLocaleTimeString()}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:"1rem",marginBottom:"1.5rem"}}>
        {[{l:"Temperature",v:`${Math.round(weather.main.temp)}°C`,i:"🌡"},{l:"Feels Like",v:`${Math.round(weather.main.feels_like)}°C`,i:"🤔"},{l:"Humidity",v:`${weather.main.humidity}%`,i:"💧"},{l:"Wind",v:`${weather.wind.speed} m/s`,i:"💨"},{l:"Condition",v:weather.weather[0].description,i:"🌥"}].map(s=>(
          <div key={s.l} className="glass" style={{textAlign:"center",padding:"1.25rem"}}>
            <div style={{fontSize:"1.8rem",marginBottom:"0.4rem"}}>{s.i}</div>
            <div style={{fontSize:"1.2rem",fontWeight:700,marginBottom:"0.2rem"}}>{s.v}</div>
            <div style={{opacity:0.55,fontSize:"0.78rem"}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem",marginBottom:"1.5rem"}}>
        <div className="glass" style={{padding:"1.25rem"}}>
          <h3 style={{fontWeight:700,marginBottom:"1rem"}}>📈 Temperature Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={forecast}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/><XAxis dataKey="day" tick={{fill:"#94a3b8",fontSize:12}}/><YAxis tick={{fill:"#94a3b8",fontSize:12}} unit="°"/><Tooltip {...tt}/><Line type="monotone" dataKey="temp" stroke="#06b6d4" strokeWidth={2.5} dot={{fill:"#06b6d4"}}/></LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass" style={{padding:"1.25rem"}}>
          <h3 style={{fontWeight:700,marginBottom:"1rem"}}>🌧 Rain Probability</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={forecast}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/><XAxis dataKey="day" tick={{fill:"#94a3b8",fontSize:12}}/><YAxis tick={{fill:"#94a3b8",fontSize:12}} unit="%"/><Tooltip {...tt}/><Bar dataKey="rain" fill="#0ea5e9" radius={[4,4,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="glass" style={{padding:"1.5rem",marginBottom:"1.25rem"}}>
        <h3 style={{fontWeight:700,marginBottom:"1rem"}}>🌍 Country Information</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"1rem"}}>
          {[{l:"💱 Currency",v:currencies},{l:"🗣 Language",v:languages},{l:"👥 Population",v:country?(country.population/1e6).toFixed(1)+"M":"—"},{l:"⏰ Timezone",v:country?(country.timezones||[])[0]:"—"},{l:"🏙 Capital",v:country?.capital?.[0]||"—"}].map(i=>(
            <div key={i.l} style={{padding:"0.85rem",background:"rgba(6,182,212,0.07)",borderRadius:12,border:"1px solid rgba(6,182,212,0.12)"}}>
              <div style={{opacity:0.55,fontSize:"0.78rem",marginBottom:"0.3rem"}}>{i.l}</div>
              <div style={{fontWeight:600,fontSize:"0.92rem"}}>{i.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem"}}>
        <div className="glass" style={{padding:"1.25rem"}}>
          <h3 style={{fontWeight:700,marginBottom:"0.5rem"}}>🗓 Best Time to Visit</h3>
          <p style={{color:"#06b6d4",fontWeight:700,fontSize:"1.2rem",marginBottom:"0.75rem"}}>{best} – {months[(months.indexOf(best)+2)%12]}</p>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {months.map((m,i)=>(
              <div key={m} style={{width:36,textAlign:"center",fontSize:"0.7rem"}}>
                <div style={{height:Math.round(scores[i]/10),background:scores[i]>80?"#06b6d4":"rgba(6,182,212,0.3)",borderRadius:"2px 2px 0 0",marginBottom:2}}/>
                {m}
              </div>
            ))}
          </div>
        </div>
        <div className="glass" style={{padding:"1.25rem"}}>
          <h3 style={{fontWeight:700,marginBottom:"0.75rem"}}>🎒 Packing Checklist</h3>
          <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
            {pack.map(i=>(
              <label key={i} style={{display:"flex",alignItems:"center",gap:"0.5rem",cursor:"pointer",fontSize:"0.88rem"}}>
                <input type="checkbox" style={{accentColor:"#06b6d4"}}/> {i}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BUDGET ────────────────────────────────────────────────────────────────────
function Budget({dark,selected}) {
  const dest=selected||DESTINATIONS[0];
  const [days,setDays]=useState(7);
  const [hotel,setHotel]=useState("Mid");
  const [food,setFood]=useState("Restaurant");
  const [acts,setActs]=useState("Cultural");
  const [curr,setCurr]=useState("USD");
  const RATES={USD:1,EUR:0.92,GBP:0.79,JPY:149,INR:83,AED:3.67,AUD:1.54};
  const hotelT=HOTEL_COSTS[hotel]*days, foodT=FOOD_COSTS[food]*days, actT=ACTIVITY_COSTS[acts]*days;
  const flights=400+Math.abs(dest.lat+dest.lon)*0.5|0, misc=Math.round((hotelT+foodT+actT)*0.1);
  const total=hotelT+foodT+actT+flights+misc, rate=RATES[curr]||1;
  const fmt=n=>(n*rate).toFixed(curr==="JPY"?0:2);
  const pie=[{name:"Hotel",value:hotelT},{name:"Food",value:foodT},{name:"Activities",value:actT},{name:"Flights",value:flights},{name:"Misc",value:misc}];
  const tt={contentStyle:{background:"#0f172a",border:"1px solid rgba(6,182,212,0.3)",borderRadius:10}};
  return (
    <div className="up">
      <h2 style={{fontSize:"1.6rem",fontWeight:800,marginBottom:"0.4rem"}}>💰 Budget Estimator</h2>
      <p style={{opacity:0.55,marginBottom:"1.5rem"}}>{dest.city}, {dest.country}</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem"}}>
        <div className="glass" style={{padding:"1.5rem"}}>
          <h3 style={{fontWeight:700,marginBottom:"1.25rem"}}>Trip Details</h3>
          <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
            <div>
              <label style={{opacity:0.6,fontSize:"0.82rem",display:"block",marginBottom:"0.4rem"}}>Days: <strong>{days}</strong></label>
              <input type="range" min={1} max={30} value={days} onChange={e=>setDays(+e.target.value)} style={{width:"100%",accentColor:"#06b6d4"}}/>
            </div>
            {[{l:"🏨 Hotel",v:hotel,s:setHotel,o:["Budget","Mid","Luxury"]},{l:"🍽 Food",v:food,s:setFood,o:["Street","Restaurant","Fine"]},{l:"🎯 Activities",v:acts,s:setActs,o:["Beach","Relaxation","Cultural","Adventure"]}].map(f=>(
              <div key={f.l}>
                <label style={{opacity:0.6,fontSize:"0.82rem",display:"block",marginBottom:"0.4rem"}}>{f.l}</label>
                <select className="inp" value={f.v} onChange={e=>f.s(e.target.value)}>{f.o.map(o=><option key={o}>{o}</option>)}</select>
              </div>
            ))}
            <div>
              <label style={{opacity:0.6,fontSize:"0.82rem",display:"block",marginBottom:"0.4rem"}}>💱 Currency</label>
              <select className="inp" value={curr} onChange={e=>setCurr(e.target.value)}>{Object.keys(RATES).map(c=><option key={c}>{c}</option>)}</select>
            </div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
          <div className="glass" style={{padding:"1.5rem",textAlign:"center"}}>
            <p style={{opacity:0.55,fontSize:"0.85rem",marginBottom:"0.4rem"}}>Total Estimated Budget</p>
            <p className="glow" style={{fontSize:"2.8rem",fontWeight:800}}>{curr} {fmt(total)}</p>
            <p style={{opacity:0.45,fontSize:"0.78rem"}}>For {days} days in {dest.city}</p>
          </div>
          <div className="glass" style={{padding:"1.25rem"}}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={pie} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} fontSize={11}>{pie.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}</Pie><Tooltip formatter={v=>`${curr} ${fmt(v)}`} {...tt}/></PieChart>
            </ResponsiveContainer>
          </div>
          {pie.map((d,i)=>(
            <div key={d.name} style={{display:"flex",justifyContent:"space-between",padding:"0.6rem 0.85rem",background:"rgba(6,182,212,0.06)",borderRadius:10}}>
              <span style={{display:"flex",alignItems:"center",gap:"0.5rem"}}><span style={{width:10,height:10,borderRadius:"50%",background:PIE_COLORS[i],display:"inline-block"}}/>{d.name}</span>
              <span style={{fontWeight:600}}>{curr} {fmt(d.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ATTRACTIONS ───────────────────────────────────────────────────────────────
function Attractions({dark,selected}) {
  const dest=selected||DESTINATIONS[0];
  const mapRef=useRef(null);
  const attractions=MOCK_ATTRACTIONS[dest.city]||MOCK_ATTRACTIONS.default;
  const [pg,setPg]=useState(1);
  const photos=useMemo(()=>Array.from({length:pg*6},(_,i)=>({id:i,url:`https://picsum.photos/seed/${dest.city}${i}/600/400`,cap:attractions[i%attractions.length]?.name||dest.city})),[dest.city,pg]);
  useLeaflet(mapRef,dest.lat,dest.lon,attractions);
  return (
    <div className="up">
      <h2 style={{fontSize:"1.6rem",fontWeight:800,marginBottom:"0.4rem"}}>🏛 Attractions Explorer</h2>
      <p style={{opacity:0.55,marginBottom:"1.5rem"}}>{dest.city}, {dest.country}</p>
      <div className="glass" style={{padding:"1rem",marginBottom:"1.5rem"}}>
        <h3 style={{fontWeight:700,marginBottom:"0.75rem"}}>🗺 Interactive Map</h3>
        <div ref={mapRef} style={{height:350,borderRadius:14,overflow:"hidden",background:"#1e293b"}}/>
      </div>
      <div className="glass" style={{padding:"1.25rem",marginBottom:"1.5rem"}}>
        <h3 style={{fontWeight:700,marginBottom:"0.75rem"}}>📍 Top Attractions</h3>
        {attractions.map((a,i)=>(
          <div key={a.name} style={{display:"flex",alignItems:"center",gap:"1rem",padding:"0.75rem 1rem",background:"rgba(6,182,212,0.07)",borderRadius:12,marginBottom:"0.5rem"}}>
            <span style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#06b6d4,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"0.85rem",flexShrink:0}}>{i+1}</span>
            <span style={{fontWeight:600}}>{a.name}</span>
          </div>
        ))}
      </div>
      <h3 style={{fontWeight:700,marginBottom:"1rem"}}>📸 Photo Gallery</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"1rem"}}>
        {photos.map(p=>(
          <div key={p.id} className="card" style={{overflow:"hidden"}}>
            <img src={p.url} alt={p.cap} style={{width:"100%",height:200,objectFit:"cover",display:"block"}} loading="lazy"/>
            <div style={{padding:"0.65rem 0.85rem",fontSize:"0.78rem",opacity:0.6}}>📷 {p.cap}</div>
          </div>
        ))}
      </div>
      <div style={{textAlign:"center",marginTop:"1.5rem"}}>
        <button className="btn2" onClick={()=>setPg(p=>p+1)}>⬇ Load More Photos</button>
      </div>
    </div>
  );
}

// ── PLANNER ───────────────────────────────────────────────────────────────────
function Planner({dark,selected,auth}) {
  const [step,setStep]=useState(0);
  const [dest,setDest]=useState(selected?.city||"");
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [budget,setBudget]=useState("Medium");
  const [acts,setActs]=useState([]);
  const [plan,setPlan]=useState(null);
  const [loading,setLoading]=useState(false);
  const [saved,setSaved]=useState(false);
  const ACT=["🏖 Beach","🥾 Hiking","🍜 Food Tour","🏛 Museum","🛍 Shopping","🌃 Nightlife","📸 Photography","🚤 Water Sports","🎭 Theater","🚴 Cycling"];
  const days=useMemo(()=>(!start||!end)?0:Math.max(1,Math.round((new Date(end)-new Date(start))/(864e5))),[start,end]);
  const toggle=a=>setActs(p=>p.includes(a)?p.filter(x=>x!==a):[...p,a]);
  const fallback=()=>`🌍 Your ${days||7}-Day ${dest||"Adventure"} Itinerary\n\n📅 Day 1 – Arrival\n• Morning: Arrive & check in\n• Afternoon: Explore city centre\n• Evening: Welcome dinner\n\n📅 Day 2 – Landmarks\n• Morning: Top historical sites\n• Afternoon: Museums & galleries\n• Evening: Sunset viewpoint\n\n📅 Days 3–${days||7} – Deep Dive\n• Activities: ${acts.join(", ")||"sightseeing & dining"}\n• Day trips to nearby spots\n• Local market shopping\n• Farewell dinner on last night`;
  const generate=async()=>{
    setLoading(true); setStep(4);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:`Create a ${days||7}-day itinerary for ${dest||"Paris"}. Budget: ${budget}. Activities: ${acts.join(", ")||"general sightseeing"}. Format each day with Morning, Afternoon, Evening. Be specific. Under 400 words.`}]})});
      const data=await res.json();
      setPlan(data.content?.map(b=>b.text||"").join("")||fallback());
    }catch{ setPlan(fallback()); }
    setLoading(false);
  };
  const save=()=>{ auth.saveTrip({dest,start,end,budget,acts,plan,savedAt:new Date().toISOString()}); setSaved(true); };
  return (
    <div className="up">
      <h2 style={{fontSize:"1.6rem",fontWeight:800,marginBottom:"0.4rem"}}>📋 Itinerary Planner</h2>
      <p style={{opacity:0.55,marginBottom:"1.5rem"}}>Build your personalised trip plan</p>
      <div style={{display:"flex",gap:"0.5rem",marginBottom:"2rem",alignItems:"center",flexWrap:"wrap"}}>
        {STEPS.map((s,i)=>(
          <div key={s} style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
            <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"0.82rem",background:i<step?"#10b981":i===step?"linear-gradient(135deg,#06b6d4,#0ea5e9)":"rgba(255,255,255,0.08)",color:i<=step?"white":"rgba(255,255,255,0.4)"}}>{i<step?"✓":i+1}</div>
            {i<STEPS.length-1&&<><span style={{fontSize:"0.8rem",opacity:i===step?1:0.45,fontWeight:i===step?600:400}}>{s}</span><div style={{width:20,height:2,background:i<step?"#06b6d4":"rgba(255,255,255,0.1)",borderRadius:1}}/></>}
          </div>
        ))}
      </div>
      <div className="glass" style={{padding:"2rem",maxWidth:580}}>
        {step===0&&(
          <div>
            <h3 style={{fontWeight:700,marginBottom:"1rem"}}>📍 Where are you going?</h3>
            <select className="inp" value={dest} onChange={e=>setDest(e.target.value)} style={{marginBottom:"0.75rem"}}>
              <option value="">Select a destination…</option>
              {DESTINATIONS.map(d=><option key={d.city} value={d.city}>{d.city}, {d.country}</option>)}
            </select>
            <input className="inp" placeholder="Or type a custom city…" value={dest} onChange={e=>setDest(e.target.value)}/>
          </div>
        )}
        {step===1&&(
          <div>
            <h3 style={{fontWeight:700,marginBottom:"1rem"}}>📅 When are you travelling?</h3>
            <label style={{opacity:0.6,fontSize:"0.82rem"}}>Start Date</label>
            <input type="date" className="inp" value={start} onChange={e=>setStart(e.target.value)} style={{marginBottom:"0.75rem",marginTop:"0.3rem"}}/>
            <label style={{opacity:0.6,fontSize:"0.82rem"}}>End Date</label>
            <input type="date" className="inp" value={end} onChange={e=>setEnd(e.target.value)} style={{marginTop:"0.3rem"}}/>
            {days>0&&<p style={{color:"#06b6d4",marginTop:"0.75rem",fontWeight:600}}>📆 {days} days</p>}
          </div>
        )}
        {step===2&&(
          <div>
            <h3 style={{fontWeight:700,marginBottom:"1rem"}}>💰 What's your budget?</h3>
            {["Low","Medium","High","Luxury"].map(b=>(
              <button key={b} onClick={()=>setBudget(b)} style={{display:"block",width:"100%",textAlign:"left",marginBottom:"0.6rem",padding:"0.85rem 1.25rem",borderRadius:12,border:`2px solid ${budget===b?"#06b6d4":"rgba(255,255,255,0.1)"}`,background:budget===b?"rgba(6,182,212,0.12)":"rgba(255,255,255,0.04)",cursor:"pointer",fontFamily:"'Sora',sans-serif",fontWeight:600,color:budget===b?"#06b6d4":"inherit"}}>
                {b==="Low"?"💵 Budget — Under $50/day":b==="Medium"?"💳 Mid-range — $50–150/day":b==="High"?"💎 Premium — $150–400/day":"👑 Luxury — $400+/day"}
              </button>
            ))}
          </div>
        )}
        {step===3&&(
          <div>
            <h3 style={{fontWeight:700,marginBottom:"0.5rem"}}>🎯 Choose Activities</h3>
            <p style={{opacity:0.55,fontSize:"0.82rem",marginBottom:"1rem"}}>Select all that interest you</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:"0.6rem"}}>
              {ACT.map(a=><button key={a} className={`chip${acts.includes(a)?" on":""}`} onClick={()=>toggle(a)}>{a}</button>)}
            </div>
          </div>
        )}
        {step===4&&(
          <div>
            {loading?(
              <div style={{textAlign:"center",padding:"2rem"}}>
                <div className="pulse" style={{fontSize:"2.5rem",marginBottom:"1rem"}}>✈️</div>
                <p style={{fontWeight:600}}>Generating your perfect itinerary…</p>
              </div>
            ):plan?(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
                  <h3 style={{fontWeight:700}}>✨ Your Itinerary</h3>
                  {!saved&&<button className="btn" style={{fontSize:"0.8rem",padding:"0.45rem 1rem"}} onClick={save}>💾 Save Trip</button>}
                  {saved&&<span style={{color:"#10b981",fontSize:"0.82rem",fontWeight:600}}>✅ Saved!</span>}
                </div>
                <div style={{whiteSpace:"pre-wrap",lineHeight:1.7,fontSize:"0.88rem",opacity:0.9,maxHeight:420,overflowY:"auto",paddingRight:"0.5rem"}}>{plan}</div>
                <button className="btn2" style={{marginTop:"1rem",fontSize:"0.82rem"}} onClick={()=>{setStep(0);setPlan(null);setSaved(false);}}>↺ Plan Another Trip</button>
              </div>
            ):null}
          </div>
        )}
        {step<4&&(
          <div style={{display:"flex",justifyContent:"space-between",marginTop:"1.5rem"}}>
            <button className="btn2" onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0}>← Back</button>
            {step<3?<button className="btn" onClick={()=>setStep(s=>s+1)} disabled={step===0&&!dest}>Next →</button>:<button className="btn" onClick={generate}>✨ Generate Plan</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({dark,user}) {
  const trips=user.savedTrips||[];
  const budgets=["Low","Medium","High","Luxury"];
  const tt={contentStyle:{background:"#0f172a",border:"1px solid rgba(6,182,212,0.3)",borderRadius:10}};
  const destData=DESTINATIONS.slice(0,6).map(d=>({name:d.city,popularity:d.pop}));
  const tempData=DESTINATIONS.slice(0,6).map(d=>({name:d.city,temp:d.tempC}));
  const budgetData=budgets.map(b=>({name:b,trips:trips.filter(t=>t.budget===b).length}));
  const expData=[{month:"Jan",spend:1200},{month:"Feb",spend:800},{month:"Mar",spend:2100},{month:"Apr",spend:1600},{month:"May",spend:900},{month:"Jun",spend:3200}];
  return (
    <div className="up">
      <h2 style={{fontSize:"1.6rem",fontWeight:800,marginBottom:"0.4rem"}}>📊 Dashboard</h2>
      <p style={{opacity:0.55,marginBottom:"1.5rem"}}>Welcome back, {user.name}!</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:"1rem",marginBottom:"1.75rem"}}>
        {[
          {l:"Saved Trips",v:trips.length,i:"🗺"},
          {l:"Destinations",v:[...new Set(trips.map(t=>t.dest))].length,i:"🌍"},
          {l:"Total Days",v:trips.reduce((s,t)=>s+Math.max(1,Math.round((new Date(t.end)-new Date(t.start))/(864e5))||0),0),i:"📅"},
          {l:"Avg Budget",v:trips.length?budgets[Math.round(trips.reduce((s,t)=>s+budgets.indexOf(t.budget),0)/trips.length)]||"—":"—",i:"💰"},
        ].map(s=>(
          <div key={s.l} className="glass" style={{textAlign:"center",padding:"1.25rem"}}>
            <div style={{fontSize:"1.6rem",marginBottom:"0.4rem"}}>{s.i}</div>
            <div style={{fontSize:"1.5rem",fontWeight:800,color:"#06b6d4"}}>{s.v}</div>
            <div style={{opacity:0.55,fontSize:"0.78rem"}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem"}}>
        <div className="glass" style={{padding:"1.25rem"}}>
          <h3 style={{fontWeight:700,marginBottom:"1rem"}}>📈 Destination Popularity</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={destData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/><XAxis dataKey="name" tick={{fill:"#94a3b8",fontSize:10}}/><YAxis tick={{fill:"#94a3b8",fontSize:10}}/><Tooltip {...tt}/><Bar dataKey="popularity" fill="#06b6d4" radius={[4,4,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass" style={{padding:"1.25rem"}}>
          <h3 style={{fontWeight:700,marginBottom:"1rem"}}>🌡 Temperature by City</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={tempData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/><XAxis dataKey="name" tick={{fill:"#94a3b8",fontSize:10}}/><YAxis tick={{fill:"#94a3b8",fontSize:10}} unit="°"/><Tooltip {...tt}/><Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2.5} dot={{fill:"#f97316"}}/></LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass" style={{padding:"1.25rem"}}>
          <h3 style={{fontWeight:700,marginBottom:"1rem"}}>💸 Expense Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={expData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)"/><XAxis dataKey="month" tick={{fill:"#94a3b8",fontSize:11}}/><YAxis tick={{fill:"#94a3b8",fontSize:11}} unit="$"/><Tooltip {...tt}/><Bar dataKey="spend" fill="#8b5cf6" radius={[4,4,0,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass" style={{padding:"1.25rem"}}>
          <h3 style={{fontWeight:700,marginBottom:"1rem"}}>🗃 Trips by Budget</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={budgetData.some(b=>b.trips>0)?budgetData:[{name:"No trips yet",trips:1}]} cx="50%" cy="50%" outerRadius={75} dataKey="trips" label={({name})=>name} fontSize={11}>
                {budgetData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}
              </Pie>
              <Tooltip {...tt}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── SAVED TRIPS ───────────────────────────────────────────────────────────────
function Trips({dark,user,nav}) {
  const trips=user.savedTrips||[];
  if(!trips.length) return (
    <div className="up" style={{textAlign:"center",padding:"4rem 1rem"}}>
      <div style={{fontSize:"4rem",marginBottom:"1rem"}}>🗺</div>
      <h2 style={{fontWeight:700,marginBottom:"0.75rem"}}>No saved trips yet</h2>
      <p style={{opacity:0.55,marginBottom:"1.5rem"}}>Use the Itinerary Planner to create and save your trips</p>
      <button className="btn" onClick={()=>nav("planner")}>📋 Plan a Trip</button>
    </div>
  );
  return (
    <div className="up">
      <h2 style={{fontSize:"1.6rem",fontWeight:800,marginBottom:"0.4rem"}}>🗺 My Saved Trips</h2>
      <p style={{opacity:0.55,marginBottom:"1.5rem"}}>{trips.length} trip{trips.length>1?"s":""} saved</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:"1.25rem"}}>
        {trips.map((t,i)=>(
          <div key={i} className="card" style={{padding:"1.5rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.75rem"}}>
              <h3 style={{fontWeight:700,fontSize:"1.1rem"}}>{t.dest}</h3>
              <span className="tag" style={{background:"rgba(6,182,212,0.15)",color:"#06b6d4"}}>{t.budget}</span>
            </div>
            <p style={{opacity:0.55,fontSize:"0.83rem",marginBottom:"0.5rem"}}>📅 {t.start} → {t.end}</p>
            {t.acts?.length>0&&<p style={{opacity:0.55,fontSize:"0.8rem",marginBottom:"0.75rem"}}>🎯 {t.acts.slice(0,3).join(" · ")}</p>}
            {t.plan&&(
              <details style={{fontSize:"0.82rem"}}>
                <summary style={{cursor:"pointer",color:"#06b6d4",fontWeight:600,marginBottom:"0.5rem"}}>View Itinerary</summary>
                <div style={{whiteSpace:"pre-wrap",opacity:0.8,lineHeight:1.6,maxHeight:220,overflowY:"auto",marginTop:"0.5rem"}}>{t.plan}</div>
              </details>
            )}
            <p style={{opacity:0.35,fontSize:"0.72rem",marginTop:"0.75rem"}}>Saved {new Date(t.savedAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}