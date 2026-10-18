'use client';
import {useState} from 'react';
import {eventMatches,prettyDate,type Opportunity} from '@/lib/event-types';
export default function EventCatalog({events,compact=false}:{events:Opportunity[];compact?:boolean}){
 const [region,setRegion]=useState('All'),[kind,setKind]=useState('All'),[cost,setCost]=useState('All'),[students,setStudents]=useState(false),[query,setQuery]=useState('');
 const filtered=events.filter(e=>eventMatches(e,region,kind,cost,students,query));
 const ranked=compact?[...filtered].sort((a,b)=>Number(b.region==='Toronto/GTA')-Number(a.region==='Toronto/GTA')||a.start_date.localeCompare(b.start_date)):filtered;
 const shown=compact?ranked.slice(0,3):ranked;
 return <div className="events-catalog">{!compact&&<form className="event-filters" onSubmit={e=>e.preventDefault()} role="search" aria-label="Find events">
  <label>Location<select value={region} onChange={e=>setRegion(e.target.value)}>{['All','Toronto/GTA','Canada','Online','Worldwide'].map(x=><option key={x} value={x}>{x==='All'?'All locations':x==='Toronto/GTA'?'Near Toronto':x==='Worldwide'?'Outside Canada':x}</option>)}</select></label>
  <label>Event type<select value={kind} onChange={e=>setKind(e.target.value)}>{['All','Conference','Summit','Meetup','Workshop','Awards'].map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Cost<select value={cost} onChange={e=>setCost(e.target.value)}>{['All','Free','Paid','Not confirmed'].map(x=><option key={x}>{x}</option>)}</select></label>
  <label className="event-search">Search<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={100} placeholder="Topic, organizer or city"/></label>
  <label className="event-checkbox"><input type="checkbox" checked={students} onChange={e=>setStudents(e.target.checked)}/> Student options explicitly listed</label>
  <button type="button" onClick={()=>{setRegion('All');setKind('All');setCost('All');setStudents(false);setQuery('');}}>Reset filters</button>
 </form>}
 {!compact&&<p className="event-count" role="status" aria-live="polite">{filtered.length} upcoming {filtered.length===1?'opportunity':'opportunities'}. Dates and times use the event’s local timezone.</p>}
 <div className="event-grid">{shown.map(e=><article className="event-card" key={e.slug}>
  <div className="event-card-top"><span>{e.kind}</span><span>{e.format}</span></div>
  <p className="event-date"><time dateTime={e.start_date}>{prettyDate(e.start_date)}</time>{e.end_date!==e.start_date&&<> – <time dateTime={e.end_date}>{prettyDate(e.end_date)}</time></>}</p>
  <h3><a href={e.official_url} target="_blank" rel="noopener noreferrer">{e.title} ↗</a></h3><p className="event-location">{e.location}</p><p className="event-organizer">By {e.organizer}</p><p>{e.summary}</p>
  <div className="event-tags"><span>{e.status}</span><span>{e.price_kind==='Not confirmed'?'Price to confirm':e.price_kind}</span>{e.student_friendly&&<span>Student pricing / access</span>}</div>
  <details><summary>Attendance, pricing & deadlines</summary><dl><dt>Who it suits</dt><dd>{e.audience}</dd><dt>Schedule</dt><dd>{e.time_note} ({e.timezone})</dd><dt>Price</dt><dd>{e.price_note}</dd><dt>Deadline</dt><dd>{e.deadline_note}</dd></dl></details>
  <div className="event-card-bottom"><a href={e.registration_url} target="_blank" rel="noopener noreferrer">{e.status==='Sold out'?'Check availability':e.status==='Approval required'?'Request to attend':'Details & registration'} ↗</a><small>Source checked {prettyDate(e.checked_at.slice(0,10))}{Date.now()-Date.parse(e.checked_at)>7*86400000?' · Recheck advised':''}</small></div>
 </article>)}</div>
 {!shown.length&&<div className="event-empty"><h3>No verified listings match yet.</h3><p>Try another filter. We add worthwhile opportunities as official details become available; an empty result does not mean no events exist.</p></div>}
 </div>;
}
