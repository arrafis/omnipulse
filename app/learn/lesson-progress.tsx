"use client";
import {useEffect,useState} from 'react';
export default function LessonProgress({slug}:{slug:string}){
 const [done,setDone]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem('omnipulse.learning.progress')||'[]');setDone(Array.isArray(v)&&v.includes(slug));}catch{}},[slug]);
 function toggle(){try{const v=JSON.parse(localStorage.getItem('omnipulse.learning.progress')||'[]');const current=Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,2000):[];localStorage.setItem('omnipulse.learning.progress',JSON.stringify(done?current.filter(x=>x!==slug):[...new Set([...current,slug])]));setDone(!done);setMessage(done?'Marked as unread.':'Progress saved on this device.');}catch{setMessage('Could not save progress. Browser storage may be disabled.');}}
 return <div className="lesson-progress"><button onClick={toggle} aria-pressed={done}>{done?'✓ Completed · Mark unread':'Mark lesson complete ✓'}</button><p role="status">{message}</p></div>;
}
