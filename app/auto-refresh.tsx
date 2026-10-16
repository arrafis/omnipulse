"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";

export default function AutoRefresh(){
 const router=useRouter();
 useEffect(()=>{
  const timer=window.setInterval(()=>{if(document.visibilityState==="visible")router.refresh();},15*60*1000);
  const onVisible=()=>{if(document.visibilityState==="visible")router.refresh();};
  document.addEventListener("visibilitychange",onVisible);
  return ()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);};
 },[router]);
 return null;
}
