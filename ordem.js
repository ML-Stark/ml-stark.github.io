/* Ordenacao das tabelas de detalhe do grafico (detalhe-inline).
   O indicador e escrito direto no elemento (sem depender de ::after). */
(function(){
"use strict";

var ASC="\u25B4", DESC="\u25BE", NEUTRO="\u2195";

function prepararCabecalhos(){
  var ths=document.querySelectorAll(".detalhe-inline thead th");
  for(var i=0;i<ths.length;i++){
    var th=ths[i];
    th.style.cursor="pointer";
    th.style.userSelect="none";
    th.style.webkitUserSelect="none";
    th.style.whiteSpace="nowrap";
    th.setAttribute("title","Toque para ordenar por esta coluna");
  }
}

function marcarSeta(th,dir){
  var todos=th.parentNode.cells;
  for(var i=0;i<todos.length;i++){
    var h=todos[i];
    if(!h.dataset.titulo)h.dataset.titulo=h.textContent.replace(/[\u25B4\u25BE\u2195]/g,"").trim();
    h.textContent=h.dataset.titulo;
    h.style.color="";
  }
  if(dir!==0){
    th.textContent=th.dataset.titulo+" "+(dir===-1?DESC:ASC);
    th.style.color="#93c5fd";
  }
}

function numero(txt){
  var s=String(txt||"").replace(/[^\d,.-]/g,"").replace(/\./g,"").replace(",",".");
  var n=parseFloat(s);
  return isFinite(n)?n:0;
}
function chaveData(txt){
  var m=String(txt||"").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? (m[3]+"-"+m[2]+"-"+m[1]) : String(txt||"");
}
function valorCelula(tr,i){
  var c=tr.cells[i];
  if(!c)return "";
  var t=c.textContent.replace(/\s+/g," ").trim();
  if(i===0)return chaveData(t);
  if(i===4)return numero(t);
  return t.toLowerCase();
}
function ordenar(tbody,indice,dir){
  var linhas=[].slice.call(tbody.rows);
  linhas.sort(function(a,b){
    var va=valorCelula(a,indice), vb=valorCelula(b,indice);
    if(typeof va==="number"&&typeof vb==="number")return (va-vb)*dir;
    if(va<vb)return -1*dir;
    if(va>vb)return 1*dir;
    return 0;
  });
  var frag=document.createDocumentFragment();
  linhas.forEach(function(tr){frag.appendChild(tr);});
  tbody.appendChild(frag);
}

document.addEventListener("click",function(ev){
  var alvo=ev.target;
  if(!alvo||!alvo.closest)return;
  var th=alvo.closest(".detalhe-inline thead th");
  if(!th)return;

  var tabela=th.closest("table");
  if(!tabela||!tabela.tBodies||!tabela.tBodies[0])return;

  var irmaos=[].slice.call(th.parentNode.cells);
  var indice=irmaos.indexOf(th);
  if(indice<0)return;

  var asc=th.dataset.dir==="asc";
  var desc=th.dataset.dir==="desc";
  var dir = (!asc&&!desc) ? (indice===4 ? -1 : 1) : (asc ? -1 : 1);

  irmaos.forEach(function(h){delete h.dataset.dir;});
  th.dataset.dir = dir===-1?"desc":"asc";

  marcarSeta(th,dir);
  ordenar(tabela.tBodies[0],indice,dir);
},true);

var obs=null;
function observar(){
  if(typeof MutationObserver==="undefined")return;
  obs=new MutationObserver(function(){prepararCabecalhos();});
  obs.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observar);
else observar();
setTimeout(prepararCabecalhos,300);
setTimeout(prepararCabecalhos,1200);
})();
