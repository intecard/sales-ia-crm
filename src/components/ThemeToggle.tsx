import {useState} from 'react';
import {Sun,Moon} from 'lucide-react';
export function ThemeToggle({onChange}:{onChange?:(theme:string)=>void}){
 const [theme,setTheme]=useState(()=>localStorage.getItem('sales-ai-theme')||'dark');
 return <button className="theme-toggle" type="button" title="Cambiar tema" aria-label={theme==='dark'?'Usar tema claro':'Usar tema oscuro'} onClick={()=>{const next=theme==='dark'?'light':'dark';setTheme(next);localStorage.setItem('sales-ai-theme',next);document.documentElement.dataset.theme=next;onChange?.(next);}}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}<span>{theme==='dark'?'Claro':'Oscuro'}</span></button>;
}
