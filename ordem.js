/* Ordenacao das tabelas de detalhe do grafico (detalhe-inline). */
(function(){
"use strict";

var st=document.createElement("style");
st.textContent=
  ".detalhe-inline thead th{cursor:pointer;user-select:none;white-space:nowrap}"+
  ".detalhe-inline thead th:hover{color:#93c5fd}"+
  ".detalhe-inline thead th.ordem-asc::after{content:' \u25B4';opacity:.95}"+
  ".detalhe-inline thead th.ordem-desc::after{content:' \u25BE';opacity:.95}"+
  ".detalhe-inline thead th:not(.ordem-asc):not(.ordem-desc)::after{content:' \u2195';opacity:.3}"+
  "@media(max-width:700px){.detalhe-inline thead th{font-size:.66rem}}";
document.head.appendChild(st);

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

  var atual = th.classList.contains("ordem-asc") ? 1
            : th.classList.contains("ordem-desc") ? -1 : 0;
  var dir = atual===0 ? (indice===4 ? -1 : 1) : -atual;

  irmaos.forEach(function(h){h.classList.remove("ordem-asc","ordem-desc");});
  th.classList.add(dir===-1?"ordem-desc":"ordem-asc");

  ordenar(tabela.tBodies[0],indice,dir);
},true);
})();
