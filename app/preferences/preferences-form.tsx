"use client";
import {useState,type FormEvent} from "react";
const all=["AI","Tech","Markets"];
export default function PreferencesForm({token,initial,plan,billingEnabled,checkout}:{token:string;initial:string[];plan:string;billingEnabled:boolean;checkout?:string}){
 const [selected,setSelected]=useState(initial.filter(x=>all.includes(x))),[busy,setBusy]=useState(false),[message,setMessage]=useState(checkout==="success"?"Payment received. Your focused edition will start when the subscription is confirmed.":"");
 function toggle(value:string){setSelected(old=>old.includes(value)?old.length>1?old.filter(x=>x!==value):old:[...old,value]);}
 async function save(event:FormEvent){
  event.preventDefault();setBusy(true);setMessage("");
  try{const res=await fetch("/api/preferences",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,categories:selected})});const data=await res.json() as {error?:string};if(!res.ok)throw new Error(data.error||"Could not save topics");setMessage(plan==="premium"?"Topics saved. Your next Focus edition will use these choices.":"Topics saved for a future Focus edition. Your free digest will continue to cover all three topics.");}
  catch(error){setMessage(error instanceof Error?error.message:"Could not save topics");}
  finally{setBusy(false);}
 }
 async function billing(action:"upgrade"|"manage"){
  setBusy(true);setMessage("");
  try{const res=await fetch("/api/premium/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,action})});const data=await res.json() as {url?:string;error?:string};if(!res.ok||!data.url)throw new Error(data.error||"Billing is temporarily unavailable");window.location.assign(data.url);}
  catch(error){setMessage(error instanceof Error?error.message:"Billing is temporarily unavailable");setBusy(false);}
 }
 return <section className="preferences-panel"><form onSubmit={save}><fieldset className="topic-choices"><legend>Follow at least one topic</legend>{all.map(value=><label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={()=>toggle(value)}/>{value}</label>)}</fieldset><button disabled={busy} type="submit" className="preferences-button">{busy?"Working…":"Save topics"}</button></form><div className="preferences-plan"><span className="plan-tag">OMNIPULSE FOCUS</span><h2>$7 CAD / month</h2><p>A morning email focused on the topics you choose, with article summaries and links to the original reporting.</p>{plan==="premium"?<>{billingEnabled?<button disabled={busy} type="button" onClick={()=>billing("manage")} className="preferences-button">Manage billing</button>:<p>Billing management is temporarily unavailable.</p>}</>:billingEnabled?<button disabled={busy} type="button" onClick={()=>billing("upgrade")} className="preferences-button">Upgrade to Focus</button>:<p>Payments are opening soon. Your free subscription continues; no charge has been made.</p>}</div>{message&&<p className="preferences-message" role="status">{message}</p>}</section>;
}
