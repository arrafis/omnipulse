"use client";
import {useState} from "react";
import {Button} from "@/components/ui/button";
export function LeaveForm({token}:{token:string}){const [done,setDone]=useState(false);const [error,setError]=useState("");return <><Button disabled={!token||done} onClick={async()=>{const res=await fetch('/api/subscribers/leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(res.ok)setDone(true);else setError('This removal link is invalid or has already been used.');}}>{done?'Removed':'Remove my address'}</Button>{done&&<p role="status">Your address has been removed.</p>}{error&&<p role="alert">{error}</p>}</>}
