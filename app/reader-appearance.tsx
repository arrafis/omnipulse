"use client";
import {useEffect} from 'react';
export default function ReaderAppearance(){
 useEffect(()=>{try{const reader=JSON.parse(localStorage.getItem('omnipulse.reader.v1')||'{}');document.documentElement.dataset.readerTheme=reader.theme==='dark'?'dark':'light';document.documentElement.dataset.readerSize=reader.large?'large':'normal';}catch{}},[]);
 return null;
}
