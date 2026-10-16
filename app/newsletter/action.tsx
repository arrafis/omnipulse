"use client";
import {useState} from "react";
export default function NewsletterAction({token,action}:{token:string;action:"confirm"|"unsubscribe"}){
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 async function submit(){
  setBusy(true);setMessage("");
  try{const res=await fetch("/api/newsletter/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});const data=await res.json() as {error?:string};if(!res.ok)throw new Error(data.error||"Please try again.");setDone(true);setMessage(action==="confirm"?"Your daily email subscription is confirmed.":"You have been unsubscribed. No further daily emails will be sent.");}
  catch(error){setMessage(error instanceof Error?error.message:"Please try again.");}
  finally{setBusy(false);}
 }
 return <><button className="newsletter-action" onClick={submit} type="button" disabled={!token||busy||done}>{busy?"Working…":done?"Done":action==="confirm"?"Confirm my email":"Unsubscribe me"}</button>{message&&<p role={done?"status":"alert"}>{message}</p>}{!token&&<p role="alert">This link is incomplete. Please open the full link from your email.</p>}</>;
}
