const fs = require("fs");
const path = require("path");

const demoBase = path.join(process.cwd(), "src", "Demo");
const settingsDir = path.join(demoBase, "Settings");

function ensure(p){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }
function write(p,c){ fs.writeFileSync(p,c,"utf8"); console.log("created",p); }

if(!fs.existsSync(path.join(demoBase,"DemoApp.jsx"))){
  console.error("❌  DemoApp.jsx not found. Run previous phases first.");
  process.exit(1);
}

ensure(settingsDir);

write(path.join(settingsDir,"Settings.jsx"), `
import React, { useState } from 'react';
import { users } from '../data/dummyData';

export default function Settings(){
  const [profile,setProfile]=useState({name:'Admin User',email:'admin@schoolcrm.demo'});
  const [role,setRole]=useState('Admin');
  const [theme,setTheme]=useState('Light');

  function save(){
    alert('Profile saved (simulated)');
  }

  return(
    <div className="settings">
      <h2>Settings & User Management</h2>

      <div className="card" style={{marginBottom:20}}>
        <h4>User Profile</h4>
        <div style={{display:'flex',gap:10,marginBottom:10}}>
          <input className="input" placeholder="Name" value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/>
          <input className="input" placeholder="Email" value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})}/>
        </div>
        <button className="btn" onClick={save}>Save Profile</button>
      </div>

      <div className="card" style={{marginBottom:20}}>
        <h4>Role Simulation</h4>
        <select className="input" value={role} onChange={e=>setRole(e.target.value)}>
          {users.map(u=><option key={u.id}>{u.role}</option>)}
        </select>
        <p className="small" style={{marginTop:8}}>Current Role: {role}</p>
      </div>

      <div className="card">
        <h4>Theme Switch</h4>
        <select className="input" value={theme} onChange={e=>setTheme(e.target.value)}>
          <option>Light</option>
          <option>Dark</option>
        </select>
        <button className="btn" style={{marginTop:10}} onClick={()=>alert('Theme switched to '+theme+' (simulated)')}>
          Apply Theme
        </button>
      </div>
    </div>
  );
}
`);

// ---- Patch DemoApp.jsx ----
const demoAppPath = path.join(demoBase,"DemoApp.jsx");
let appCode=fs.readFileSync(demoAppPath,"utf8");

if(!appCode.includes("import Settings")){
  appCode=appCode
    .replace("import Dashboard from './Dashboard/Dashboard';",
             "import Dashboard from './Dashboard/Dashboard';\nimport Settings from './Settings/Settings';")
    .replace("default: return <Dashboard />;",
             "case 'settings': return <Settings />;\n      default: return <Dashboard />;")
    .replace("</ul>",
             "  <li className={active==='settings'?'active':''} onClick={()=>setActive('settings')}>Settings</li>\n        </ul>");
  fs.writeFileSync(demoAppPath,appCode,"utf8");
  console.log("✅  Updated DemoApp.jsx with Settings link");
}

console.log("✅  Settings component added (Phase 10 complete)");
console.log("🎉 All CRM demo components created successfully!");
