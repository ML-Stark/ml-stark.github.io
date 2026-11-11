(function(){
"use strict";

var LS_URL="mls_url", LS_TOKEN="mls_token", LS_USER="mls_user", LS_SESSAO="mls_sessao";
var MESES=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
var CORES=["#3b82f6","#22c55e","#ef4444","#eab308","#a855f7","#06b6d4","#f97316","#ec4899","#84cc16","#64748b"];

var cfg={url:"",token:"",usuario:"maik"};
var dados=null;
var tipoAtual="despesa";
var filtroDash={tipo:null,valor:null};
var editando=null;
var ultimaLeitura=null;

function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function brl(v){return "R$ "+(Number(v)||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});}
function pct(v){return (Number(v)||0).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";}
function isoParaBR(iso){if(!iso)return "—";var p=String(iso).split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:iso;}
function hojeISO(){var d=new Date();return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);}
function mesDe(iso){return iso?iso.slice(0,7)+"-01":"";}
function mesLabel(ym){if(!ym)return "—";var p=ym.split("-");return MESES[+p[1]-1]+"/"+p[0];}
function parseValor(txt){
  var s=String(txt==null?"":txt).replace(/R\$/gi,"").replace(/\s/g,"");
  if(!s)return NaN;
  if(s.indexOf(",")>-1&&s.indexOf(".")>-1)s=s.replace(/\./g,"").replace(",",".");
  else s=s.replace(",",".");
  var n=Number(s);return isFinite(n)?n:NaN;
}
function toast(msg,tipo){
  var el=document.createElement("div");
  el.textContent=msg;
  el.style.cssText="position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:99;padding:11px 18px;border-radius:11px;font-size:.85rem;font-weight:600;max-width:88vw;text-align:center;"+
    (tipo==="erro"?"background:#7f1d1d;color:#fecaca;border:1px solid #ef4444":tipo==="ok"?"background:#14532d;color:#bbf7d0;border:1px solid #22c55e":"background:#1e293b;color:#e2e8f0;border:1px solid #334155");
  document.body.appendChild(el);
  setTimeout(function(){el.style.transition="opacity .3s";el.style.opacity="0";setTimeout(function(){el.remove();},320);},2600);
}

function lerCfg(){
  try{
    cfg.url=(localStorage.getItem(LS_URL)||"").trim();
    cfg.token=(localStorage.getItem(LS_TOKEN)||"").trim();
    cfg.usuario=(localStorage.getItem(LS_USER)||"maik").trim();
  }catch(e){}
}
function gravarCfg(){
  try{
    localStorage.setItem(LS_URL,cfg.url);
    localStorage.setItem(LS_TOKEN,cfg.token);
    localStorage.setItem(LS_USER,cfg.usuario);
  }catch(e){}
}
function configurado(){return !!(cfg.url&&cfg.token);}
function urlValida(u){
  if(!u)return false;
  if(!/^https?:\/\//i.test(u))return false;
  if(/localhost|127\.0\.0\.1/.test(u))return true;
  return /^https:\/\/[^\s]+\/exec\/?$/i.test(u.trim());
}

function urlCom(params){
  var q=[];
  for(var k in params){if(params.hasOwnProperty(k))q.push(encodeURIComponent(k)+"="+encodeURIComponent(params[k]));}
  var sep=cfg.url.indexOf("?")>-1?"&":"?";
  return cfg.url+sep+q.join("&");
}
function chamarGET(params,timeoutMs){
  var ctrl=typeof AbortController!=="undefined"?new AbortController():null;
  var timer=setTimeout(function(){if(ctrl)ctrl.abort();},timeoutMs||20000);
  return fetch(urlCom(params),{method:"GET",redirect:"follow",signal:ctrl?ctrl.signal:undefined})
    .then(function(r){
      if(!r.ok)throw new Error("HTTP "+r.status);
      return r.text();
    })
    .then(function(txt){
      clearTimeout(timer);
      var j;
      try{j=JSON.parse(txt);}catch(e){throw new Error("Resposta não é JSON. Confira a URL /exec.");}
      return j;
    })
    .catch(function(e){
      clearTimeout(timer);
      if(e&&e.name==="AbortError")throw new Error("Tempo esgotado ao falar com a planilha.");
      throw e;
    });
}
function chamarPOST(corpo){
  var body=JSON.stringify(corpo);
  return fetch(cfg.url,{
    method:"POST",
    redirect:"follow",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:body
  }).then(function(r){
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.text();
  }).then(function(txt){
    try{return JSON.parse(txt);}catch(e){throw new Error("Resposta inválida da planilha.");}
  });
}

function carregar(silencioso){
  if(!configurado())return Promise.reject(new Error("Configure a conexão primeiro."));
  if(!silencioso)setHub("Lendo a planilha…");
  return chamarGET({acao:"ler",token:cfg.token}).then(function(j){
    if(!j.ok){
      if(j.erro==="token")throw new Error("Senha (token) recusada pela planilha.");
      throw new Error(j.erro||"Falha ao ler a planilha.");
    }
    dados=j;
    ultimaLeitura=new Date();
    aplicarDicionario();
    preencherOpcoes();
    renderHub();
    if(!$("fin-dashboard").classList.contains("hidden"))renderDashboard();
    if(!$("fin-historico").classList.contains("hidden"))renderHistorico();
    return j;
  });
}
function setHub(txt){var e=$("hub-status");if(e)e.textContent=txt;}

function aplicarDicionario(){
  var cats=dados&&dados.categorias?dados.categorias:{};
  var nomes=Object.keys(cats);
  $("l-cat").innerHTML=nomes.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join("");
  $("e-cat").innerHTML=nomes.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join("");
  var formas=(dados&&dados.formas)||["Cartão de Crédito","Cartão de Débito","Dinheiro","Pix","Transferência","Boleto"];
  var opf=formas.map(function(f){return '<option value="'+esc(f)+'">'+esc(f)+'</option>';}).join("");
  $("l-forma").innerHTML=opf;
  $("e-forma").innerHTML=opf;
  var cartoes=(dados&&dados.cartoes)||[];
  var opc='<option value="">Selecione o cartão</option>'+cartoes.map(function(c){return '<option value="'+esc(c.nome)+'">'+esc(c.nome)+'</option>';}).join("");
  $("l-cartao").innerHTML=opc;
  $("e-cartao").innerHTML=opc;
  preencherSubs("l-cat","l-sub");
  preencherSubs("e-cat","e-sub");
}
function subsDe(cat){
  var cats=(dados&&dados.categorias)||{};
  return cats[cat]||[];
}
function preencherSubs(catId,subId){
  var cat=$(catId).value;
  var subs=subsDe(cat);
  $(subId).innerHTML=subs.map(function(s){return '<option value="'+esc(s)+'">'+esc(s)+'</option>';}).join("");
}

function bancoDoCartao(nome){
  var cartoes=(dados&&dados.cartoes)||[];
  for(var i=0;i<cartoes.length;i++){if(cartoes[i].nome===nome)return cartoes[i].banco||"";}
  return "";
}
function atualizarAuto(){
  var data=$("l-data").value;
  $("a-mes").value=data?isoParaBR(mesDe(data)):"";
  var forma=$("l-forma").value;
  var isCred=forma==="Cartão de Crédito";
  $("wrap-cartao").classList.toggle("hidden",!isCred);
  $("a-banco").value=isCred?bancoDoCartao($("l-cartao").value):"";
  var cat=$("l-cat").value;
  $("a-tipo").value=(cat==="Renda")?"Receita":(tipoAtual==="receita"?"Receita":"Despesa");
}
function setTipo(t){
  tipoAtual=t;
  $("t-desp").className="toggle-btn"+(t==="despesa"?" on-desp":"");
  $("t-rec").className="toggle-btn"+(t==="receita"?" on-rec":"");
  $("t-desp").setAttribute("aria-pressed",t==="despesa");
  $("t-rec").setAttribute("aria-pressed",t==="receita");
  atualizarAuto();
}

function validarForm(){
  var desc=$("l-desc").value.trim();
  var valor=parseValor($("l-valor").value);
  var data=$("l-data").value;
  var cat=$("l-cat").value, sub=$("l-sub").value, forma=$("l-forma").value, cartao=$("l-cartao").value;
  if(!(valor>0))return "Informe um valor maior que zero (ex.: 42,90).";
  if(!desc)return "A descrição não pode ficar vazia.";
  if(!data)return "Informe a data.";
  if(!cat)return "Selecione a categoria.";
  if(!sub)return "Selecione a subcategoria.";
  if(!forma)return "Selecione a forma de pagamento.";
  if(forma==="Cartão de Crédito"&&!cartao)return "Para cartão de crédito, escolha o cartão.";
  return null;
}
function lancar(e){
  e.preventDefault();
  var erro=validarForm();
  var box=$("lanc-erro"), ok=$("lanc-ok");
  ok.classList.add("hidden");
  if(erro){box.textContent=erro;box.classList.remove("hidden");return;}
  box.classList.add("hidden");

  var forma=$("l-forma").value;
  var item={
    data:$("l-data").value,
    descricao:$("l-desc").value.trim(),
    categoria:$("l-cat").value,
    subcategoria:$("l-sub").value,
    valor:parseValor($("l-valor").value),
    tipo:$("l-cat").value==="Renda"?"receita":tipoAtual,
    forma:forma,
    cartao:forma==="Cartão de Crédito"?$("l-cartao").value:""
  };

  var btn=$("btn-lancar");
  btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span> Gravando…';

  chamarPOST({token:cfg.token,acao:"lancar",usuario:cfg.usuario,itens:[item]})
    .then(function(j){
      if(!j.ok)throw new Error(j.erro==="token"?"Senha recusada.":(j.erro||"Falha ao gravar."));
      var r=(j.resultados&&j.resultados[0])||{status:"?"};
      if(r.status==="duplicado"){
        ok.textContent="Este lançamento já existe na planilha (linha "+r.linha+"). Nada foi duplicado.";
        ok.classList.remove("hidden");
        ok.className="notice-warn";
      }else if(r.status==="invalido"){
        throw new Error(r.erro||"A planilha recusou este lançamento.");
      }else{
        ok.textContent="Gravado na planilha — linha "+r.linha+". Sincronizando…";
        ok.className="notice-ok";
        ok.classList.remove("hidden");
      }
      var formaMantida=forma, tipoMantido=tipoAtual;
      $("l-desc").value="";$("l-valor").value="";
      $("l-data").value=hojeISO();
      $("l-forma").value=formaMantida;
      setTipo(tipoMantido);
      return carregar(true).then(function(){
        ok.textContent=ok.textContent.replace("Sincronizando…","Dashboard atualizado.");
      });
    })
    .catch(function(err){
      box.textContent=err.message;
      box.classList.remove("hidden");
    })
    .then(function(){
      btn.disabled=false;
      btn.textContent="Lançar na planilha";
    });
}

function preencherOpcoes(){
  var meses=mesesDisponiveis();
  var sel=$("dash-mes");
  var atual=sel.value||"todos";
  sel.innerHTML='<option value="todos">Todos</option>'+meses.map(function(m){return '<option value="'+m+'">'+mesLabel(m)+'</option>';}).join("");
  sel.value=(atual==="todos"||meses.indexOf(atual)>-1)?atual:"todos";

  var hsel=$("h-mes");
  var hatual=hsel.value||"todos";
  hsel.innerHTML='<option value="todos">Todos</option>'+meses.map(function(m){return '<option value="'+m+'">'+mesLabel(m)+'</option>';}).join("");
  hsel.value=(hatual==="todos"||meses.indexOf(hatual)>-1)?hatual:"todos";
}
function todosLancamentos(){return (dados&&dados.lancamentos)?dados.lancamentos:[];}
function mesesDisponiveis(){
  var s={};
  todosLancamentos().forEach(function(l){var k=String(l.mes||"").slice(0,7);if(k)s[k]=1;});
  return Object.keys(s).sort();
}
function assinatura(l){
  return [l.data,String(l.descricao||"").toLowerCase().trim().replace(/\s+/g," "),(Number(l.valor)||0).toFixed(2)].join("|");
}
function renderHistorico(){
  var mes=$("h-mes").value;
  var q=($("h-busca").value||"").trim().toLowerCase();
  var lista=todosLancamentos().filter(function(l){
    if(mes!=="todos"&&String(l.mes).indexOf(mes)!==0)return false;
    if(q){
      var alvo=(l.descricao+" "+l.categoria+" "+l.subcategoria+" "+l.forma+" "+l.cartao).toLowerCase();
      if(alvo.indexOf(q)===-1)return false;
    }
    return true;
  }).sort(function(a,b){return a.data<b.data?1:a.data>b.data?-1:0;});
  $("hist-count").textContent=lista.length+(lista.length===1?" registro":" registros");
  if(!lista.length){
    $("hist-lista").innerHTML='<p class="muted-txt">Nenhum lançamento com esses filtros.</p>';
    return;
  }
  $("hist-lista").innerHTML=lista.slice(0,150).map(function(l){
    return '<div class="hist-item">'+
      '<div class="h-main">'+
        '<div class="row-x" style="gap:6px"><strong>'+esc(l.descricao)+'</strong>'+
        '<span class="tag '+(l.tipo==="Receita"?"tag-ok":"tag-red")+'">'+esc(l.tipo)+'</span></div>'+
        '<div class="muted-txt">'+isoParaBR(l.data)+' · '+esc(l.categoria)+' › '+esc(l.subcategoria)+'</div>'+
        '<div class="muted-txt">'+esc(l.forma)+(l.cartao?' · '+esc(l.cartao):'')+' · linha '+l.linha+'</div>'+
      '</div>'+
      '<div class="row-x" style="flex-direction:column;align-items:flex-end;gap:6px">'+
        '<strong class="'+(l.tipo==="Receita"?"pos":"neg")+'">'+brl(l.valor)+'</strong>'+
        '<div class="row-x" style="gap:2px">'+
          '<button class="btn-ico" data-edit="'+l.linha+'">✎ editar</button>'+
          '<button class="btn-ico" data-del="'+l.linha+'" style="color:#ef4444">🗑</button>'+
        '</div>'+
      '</div></div>';
  }).join("");
}
function acharLinha(linha){
  var t=todosLancamentos();
  for(var i=0;i<t.length;i++){if(String(t[i].linha)===String(linha))return t[i];}
  return null;
}

function abrirEditar(linha){
  var l=acharLinha(linha);
  if(!l){toast("Lançamento não encontrado. Atualize.","erro");return;}
  editando=l;
  $("e-data").value=l.data;
  $("e-valor").value=String(l.valor).replace(".",",");
  $("e-desc").value=l.descricao;
  $("e-cat").value=l.categoria;
  preencherSubs("e-cat","e-sub");
  $("e-sub").value=l.subcategoria;
  $("e-forma").value=l.forma;
  $("e-cartao").value=l.cartao||"";
  atualizarAutoEditar();
  $("editar-erro").classList.add("hidden");
  $("modal-editar").classList.add("open");
}
function atualizarAutoEditar(){
  var isCred=$("e-forma").value==="Cartão de Crédito";
  $("e-wrap-cartao").classList.toggle("hidden",!isCred);
}
function salvarEdicao(e){
  e.preventDefault();
  if(!editando)return;
  var box=$("editar-erro");
  var valor=parseValor($("e-valor").value);
  if(!(valor>0)){box.textContent="Valor inválido.";box.classList.remove("hidden");return;}
  var forma=$("e-forma").value;
  if(forma==="Cartão de Crédito"&&!$("e-cartao").value){
    box.textContent="Escolha o cartão.";box.classList.remove("hidden");return;
  }
  var btn=$("btn-salvar-edit");
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Salvando…';
  chamarPOST({
    token:cfg.token,acao:"atualizar",usuario:cfg.usuario,
    linha:editando.linha,assinatura:assinatura(editando),
    item:{
      data:$("e-data").value,descricao:$("e-desc").value.trim(),
      categoria:$("e-cat").value,subcategoria:$("e-sub").value,valor:valor,
      tipo:$("e-cat").value==="Renda"?"receita":"despesa",
      forma:forma,cartao:forma==="Cartão de Crédito"?$("e-cartao").value:""
    }
  }).then(function(j){
    if(!j.ok)throw new Error(j.erro||"Falha ao salvar.");
    $("modal-editar").classList.remove("open");
    toast("Alteração gravada na planilha","ok");
    return carregar(true);
  }).catch(function(err){
    box.textContent=err.message;box.classList.remove("hidden");
  }).then(function(){
    btn.disabled=false;btn.textContent="Salvar na planilha";
  });
}

function abrirExcluir(linha){
  var l=acharLinha(linha);
  if(!l){toast("Lançamento não encontrado. Atualize.","erro");return;}
  $("exc-dados").innerHTML=isoParaBR(l.data)+" · "+esc(l.descricao)+" · "+brl(l.valor)+" · "+esc(l.forma)+"<br><span class='muted-txt'>Linha "+l.linha+" da aba Lançamentos</span>";
  $("exc-linha").value=l.linha;
  $("exc-assinatura").value=assinatura(l);
  $("exc-erro").classList.add("hidden");
  $("modal-excluir").classList.add("open");
}
function confirmarExclusao(){
  var btn=$("btn-confirmar-exc");
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Apagando…';
  chamarPOST({
    token:cfg.token,acao:"excluir",usuario:cfg.usuario,
    linha:$("exc-linha").value,assinatura:$("exc-assinatura").value
  }).then(function(j){
    if(!j.ok)throw new Error(j.erro||"Falha ao excluir.");
    $("modal-excluir").classList.remove("open");
    toast("Lançamento apagado da planilha","ok");
    return carregar(true);
  }).catch(function(err){
    $("exc-erro").textContent=err.message;
    $("exc-erro").classList.remove("hidden");
  }).then(function(){
    btn.disabled=false;btn.textContent="Apagar da planilha";
  });
}

function baseMes(mes){
  var t=todosLancamentos();
  return mes==="todos"?t:t.filter(function(l){return String(l.mes).indexOf(mes)===0;});
}
function comChip(lista){
  if(!filtroDash.tipo)return lista;
  if(filtroDash.tipo==="categoria")return lista.filter(function(l){return l.categoria===filtroDash.valor&&l.tipo==="Despesa";});
  if(filtroDash.tipo==="sub")return lista.filter(function(l){return l.subcategoria===filtroDash.valor&&l.tipo==="Despesa";});
  if(filtroDash.tipo==="forma")return lista.filter(function(l){return l.forma===filtroDash.valor&&l.tipo==="Despesa";});
  return lista;
}
function filtrado(){return comChip(baseMes($("dash-mes").value||"todos"));}
function soma(lista,campo){return lista.reduce(function(a,l){return a+(Number(l[campo])||0);},0);}
function agrupar(lista,fn,soDesp){
  var m={};
  lista.forEach(function(l){
    if(soDesp&&l.tipo!=="Despesa")return;
    var k=fn(l);
    if(!k)return;
    m[k]=(m[k]||0)+(Number(l.valor)||0);
  });
  return Object.keys(m).map(function(k){return [k,m[k]];}).sort(function(a,b){return b[1]-a[1];});
}

function renderKPIs(){
  var base=filtrado();
  var desp=base.filter(function(l){return l.tipo==="Despesa";});
  var rec=base.filter(function(l){return l.tipo==="Receita";});
  var td=soma(desp,"valor"), tr=soma(rec,"valor");
  var cred=soma(desp.filter(function(l){return l.forma==="Cartão de Crédito";}),"valor");
  var deb=soma(desp.filter(function(l){return l.forma!=="Cartão de Crédito";}),"valor");
  var saldo=tr-td;
  var cats=agrupar(desp,function(l){return l.categoria;},false);
  var maior=cats[0]||["—",0];
  var pc=td?(maior[1]/td*100):0;
  var mes=$("dash-mes").value||"todos";
  $("faixa-filtro").textContent=(mes==="todos"?"Todos os meses":mesLabel(mes))+" · "+base.length+" lançamentos ("+desp.length+" despesas, "+rec.length+" receitas)";
  $("kpis").innerHTML=[
    kpi("Total Despesas",brl(td),"neg",desp.length+" lançamentos"),
    kpi("Despesas Crédito",brl(cred),"neg","faturas de cartão"),
    kpi("Débito / Pix / Boleto",brl(deb),"neg","saída imediata"),
    kpi("Total Receitas",brl(tr),"pos",rec.length+" entradas"),
    kpi("Saldo",brl(saldo),saldo<0?"neg":"pos",saldo<0?"despesas acima das receitas":"receitas cobrem despesas"),
    kpi("Maior Categoria",esc(maior[0]),"",brl(maior[1])+" · "+pct(pc)+" das despesas"),
    kpi("Média por lançamento",brl(desp.length?td/desp.length:0),"",desp.length+" despesas"),
    kpi("Ticket médio de crédito",brl(cred/(desp.filter(function(l){return l.forma==="Cartão de Crédito";}).length||1)),"","por compra no cartão")
  ].join("");
}
function kpi(lbl,val,cls,cap){
  return '<div class="kpi-card"><div class="lbl">'+lbl+'</div><div class="val '+cls+'">'+val+'</div><div class="cap">'+cap+'</div></div>';
}

function insightsDe(mes){
  var todos=todosLancamentos();
  var desp=todos.filter(function(l){return l.tipo==="Despesa";});
  var alvo=mes||($("dash-mes").value||"todos");
  if(alvo==="todos"){
    var ms=mesesDisponiveis();
    alvo=ms.length?ms[ms.length-1]:null;
  }
  if(!alvo)return {recorrente:0,parcelas:0,assinaturas:0,fora:0,proj:null,fixoPago:0,varPago:0,receita:0};

  var porNome={};
  desp.forEach(function(l){
    var k=String(l.descricao||"").toLowerCase().trim();
    if(!k)return;
    var m=String(l.mes||"").slice(0,7);
    if(!porNome[k])porNome[k]={meses:{},vals:[]};
    porNome[k].meses[m]=1;
    porNome[k].vals.push(Number(l.valor)||0);
  });
  var recorrentes={};
  var assinaturasRe=/(netflix|spotify|disney|hbo|prime video|crunchyroll|gympass|wellhub|adapta|internet|unimed|armazenamento|icloud|google one|youtube premium|deezer|globoplay|paramount|apple tv|canva|chatgpt|claude)/i;
  var verificaParcela=/(parcela|\d+\/\d+|notebook|celular|iphone|geladeira|sof[aá]|m[oó]veis)/i;
  var recTotal=0, assTotal=0, parcTotal=0;
  for(var n in porNome){
    if(!porNome[n])continue;
    var nMeses=Object.keys(porNome[n].meses).length;
    var media=porNome[n].vals.reduce(function(a,b){return a+b;},0)/porNome[n].vals.length;
    if(nMeses>=3){
      recorrentes[n]=media;
      recTotal+=media;
      if(assinaturasRe.test(n))assTotal+=media;
      if(verificaParcela.test(n)&&media>=100)parcTotal+=media;
    }
  }

  var doMes=desp.filter(function(l){return String(l.mes).indexOf(alvo)===0;});
  var fora=doMes.filter(function(l){return l.subcategoria==="Restaurantes"||l.subcategoria==="Delivery";});
  var foraTotal=soma(fora,"valor");

  var fixoPago=0, varPago=0;
  doMes.forEach(function(l){
    var k=String(l.descricao||"").toLowerCase().trim();
    if(recorrentes[k]!==undefined)fixoPago+=Number(l.valor)||0;
    else varPago+=Number(l.valor)||0;
  });
  var receita=soma(todos.filter(function(l){return l.tipo==="Receita"&&String(l.mes).indexOf(alvo)===0;}),"valor");
  var proj=null;
  var hoje=new Date();
  var anoMes=alvo.slice(0,7);
  var hojeAnoMes=hoje.getFullYear()+"-"+("0"+(hoje.getMonth()+1)).slice(-2);
  if(anoMes===hojeAnoMes){
    var dia=hoje.getDate();
    var diasNoMes=new Date(hoje.getFullYear(),hoje.getMonth()+1,0).getDate();
    var ritmo=dia>0?varPago/dia:0;
    proj=Math.round((receita-(fixoPago+ritmo*diasNoMes))*100)/100;
  }
  return {recorrente:recTotal,parcelas:parcTotal,assinaturas:assTotal,fora:foraTotal,proj:proj,fixoPago:fixoPago,varPago:varPago,receita:receita};
}

function renderAlerta(){
  var mes=$("dash-mes").value||"todos";
  var alvo=$("dash-alerta");
  var h="";
  if(mes==="todos"){
    var ms=mesesDisponiveis();
    if(!ms.length){alvo.innerHTML="";return;}
    mes=ms[ms.length-1];
  }
  var base=baseMes(mes);
  if(!base.length){alvo.innerHTML="";return;}
  var saldo=soma(base.filter(function(l){return l.tipo==="Receita";}),"valor")-soma(base.filter(function(l){return l.tipo==="Despesa";}),"valor");
  if(saldo<0){
    h+='<div class="alert-neg"><span style="font-size:1.2rem">⚠</span><div><strong>Saldo negativo em '+mesLabel(mes)+'</strong>'+
       '<div class="muted-txt" style="color:#fca5a5">'+brl(saldo)+' — despesas acima das receitas neste mês.</div></div></div>';
  }
  var ins=insightsDe(mes);
  if(ins.proj!==null&&ins.proj<0){
    h+='<div class="alert-neg" style="margin-top:10px;border-color:#eab308;background:rgba(234,179,8,.1)"><span style="font-size:1.2rem">📉</span><div><strong>Projeção de fechamento negativa</strong>'+
       '<div class="muted-txt" style="color:#fde68a">No ritmo atual, '+mesLabel(mes)+' fecha em '+brl(ins.proj)+'.</div></div></div>';
  }
  alvo.innerHTML=h;
}

function renderInsights(){
  var mes=$("dash-mes").value||"todos";
  var i=insightsDe(mes);
  var td=soma(filtrado().filter(function(l){return l.tipo==="Despesa";}),"valor");
  var cards=[
    ["Custo recorrente",brl(i.recorrente),"por mês · itens em 3+ meses","#3b82f6"],
    ["Assinaturas",brl(i.assinaturas),"por mês · "+brl(i.assinaturas*12)+"/ano","#a855f7"],
    ["Parcelas prováveis",brl(i.parcelas),"por mês enquanto durar","#f97316"],
    ["Refeição fora",brl(i.fora),td?pct(i.fora/td*100)+" das despesas do mês":"—","#eab308"]
  ];
  var h='<div class="grid-kpi">'+cards.map(function(c){
    return '<div class="kpi-card"><div class="lbl">'+c[0]+'</div><div class="val" style="color:'+c[3]+'">'+c[1]+'</div><div class="cap">'+c[2]+'</div></div>';
  }).join("")+'</div>';

  if(i.proj!==null){
    var p=i.proj;
    h+='<div class="card-box"><div class="row-between"><h3 style="font-size:.95rem">Projeção de fechamento do mês</h3>'+
       '<span class="tag '+(p<0?"tag-red":"tag-ok")+'">'+(p<0?"atenção":"no ritmo")+'</span></div>'+
       '<div style="font-size:1.5rem;font-weight:700;margin-top:8px" class="'+(p<0?"neg":"pos")+'">'+brl(p)+'</div>'+
       '<div class="muted-txt">Custo fixo já pago '+brl(i.fixoPago)+' · variável no ritmo '+brl(i.varPago)+' · receita '+brl(i.receita)+'</div>'+
       '<div class="helper">Recalculado a cada leitura, usando o ritmo de gasto variável dos dias já decorridos.</div></div>';
  }
  $("insights").innerHTML=h;
}

function svgDonut(host,dados,onClick){
  var total=dados.reduce(function(a,d){return a+d[1];},0);
  if(!total){host.innerHTML='<p class="muted-txt">Sem dados para este filtro.</p>';return;}
  var size=200,r=78,cx=100,cy=100,sw=30;
  var circ=2*Math.PI*r,off=0;
  var arcs=dados.map(function(d,i){
    var frac=d[1]/total,len=frac*circ,cor=CORES[i%CORES.length];
    var seg='<circle class="donut-slice" data-idx="'+i+'" cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+cor+'" stroke-width="'+sw+'" stroke-dasharray="'+len+' '+(circ-len)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 '+cx+' '+cy+')"><title>'+esc(d[0])+': '+brl(d[1])+' ('+Math.round(frac*100)+'%)</title></circle>';
    off+=len;return seg;
  }).join("");
  var leg=dados.map(function(d,i){
    return '<button class="legend-item" data-idx="'+i+'"><span class="legend-sw" style="background:'+CORES[i%CORES.length]+'"></span><span style="flex:1">'+esc(d[0])+'</span><span class="muted-txt" style="margin:0">'+Math.round(d[1]/total*100)+'%</span></button>';
  }).join("");
  host.innerHTML='<div class="donut-wrap"><svg viewBox="0 0 '+size+' '+size+'">'+arcs+
    '<text x="'+cx+'" y="'+(cy-2)+'" text-anchor="middle" class="svg-tip" style="font-size:13px">'+brl(total)+'</text>'+
    '<text x="'+cx+'" y="'+(cy+14)+'" text-anchor="middle" class="svg-axis">total</text></svg>'+
    '<div class="legend-list">'+leg+'</div></div>';
  host.querySelectorAll("[data-idx]").forEach(function(el){
    el.addEventListener("click",function(){if(onClick)onClick(dados[+el.dataset.idx][0]);});
  });
}
function svgBarras(host,labels,valores,cor){
  var W=560,H=260,pad={l:60,r:12,t:18,b:42};
  var max=Math.max.apply(null,valores.concat([1]));
  var bw=(W-pad.l-pad.r)/Math.max(labels.length,1);
  var bars=valores.map(function(v,i){
    var h=(v/max)*(H-pad.t-pad.b),x=pad.l+i*bw+bw*0.2,y=H-pad.b-h;
    return '<rect x="'+x+'" y="'+y+'" width="'+bw*0.6+'" height="'+h+'" rx="4" fill="'+cor+'"><title>'+esc(labels[i])+': '+brl(v)+'</title></rect>'+
      '<text x="'+(x+bw*0.3)+'" y="'+(y-6)+'" text-anchor="middle" class="svg-axis">'+brl(v)+'</text>'+
      '<text x="'+(x+bw*0.3)+'" y="'+(H-pad.b+15)+'" text-anchor="middle" class="svg-axis">'+esc(String(labels[i]).substring(0,12))+'</text>';
  }).join("");
  host.innerHTML='<svg viewBox="0 0 '+W+' '+H+'">'+bars+'</svg>';
}
function svgEmpilhadas(host,labels,cred,deb){
  var W=560,H=280,pad={l:40,r:10,t:14,b:64};
  var tots=labels.map(function(_,i){return cred[i]+deb[i];});
  var max=Math.max.apply(null,tots.concat([1]));
  var bw=(W-pad.l-pad.r)/Math.max(labels.length,1);
  var hAll=H-pad.t-pad.b;
  var cols=labels.map(function(l,i){
    var x=pad.l+i*bw+bw*0.18,wb=bw*0.64;
    var hD=(deb[i]/max)*hAll,hC=(cred[i]/max)*hAll;
    var yD=H-pad.b-hD,yC=yD-hC;
    return '<rect x="'+x+'" y="'+yD+'" width="'+wb+'" height="'+hD+'" fill="#22c55e" rx="3"><title>'+esc(l)+' · Débito: '+brl(deb[i])+'</title></rect>'+
      '<rect x="'+x+'" y="'+yC+'" width="'+wb+'" height="'+hC+'" fill="#3b82f6" rx="3"><title>'+esc(l)+' · Crédito: '+brl(cred[i])+'</title></rect>'+
      '<text x="'+(x+wb/2)+'" y="'+(H-pad.b+14)+'" text-anchor="end" transform="rotate(-35 '+(x+wb/2)+' '+(H-pad.b+14)+')" class="svg-axis">'+esc(String(l).substring(0,14))+'</text>';
  }).join("");
  var leg='<g transform="translate('+(W-190)+',6)"><rect width="10" height="10" fill="#3b82f6"/><text x="16" y="9" class="svg-axis">Crédito</text><rect x="78" width="10" height="10" fill="#22c55e"/><text x="94" y="9" class="svg-axis">Débito</text></g>';
  host.innerHTML='<svg viewBox="0 0 '+W+' '+H+'">'+leg+cols+'</svg>';
}
function svgLinha(host,labels,series,destaque){
  var W=560,H=260,pad={l:60,r:14,t:26,b:34};
  var todos=series.reduce(function(a,s){return a.concat(s.valores);},[]);
  var max=Math.max.apply(null,todos.concat([1]))*1.1;
  var xs=labels.map(function(_,i){return pad.l+(i*(W-pad.l-pad.r))/Math.max(labels.length-1,1);});
  function yof(v){return H-pad.b-(v/max)*(H-pad.t-pad.b);}
  var linhas=series.map(function(s){
    var pts=s.valores.map(function(v,i){return xs[i]+","+yof(v);}).join(" ");
    var dots=s.valores.map(function(v,i){
      var sel=(i===destaque);
      return '<circle cx="'+xs[i]+'" cy="'+yof(v)+'" r="'+(sel?7:4)+'" fill="'+s.cor+'"'+(sel?' stroke="#e2e8f0" stroke-width="2"':'')+'><title>'+s.nome+' '+labels[i]+': '+brl(v)+'</title></circle>';
    }).join("");
    return '<polyline points="'+pts+'" fill="none" stroke="'+s.cor+'" stroke-width="3" stroke-linejoin="round"/>'+dots;
  }).join("");
  var eixos=labels.map(function(l,i){return '<text x="'+xs[i]+'" y="'+(H-10)+'" text-anchor="middle" class="svg-axis">'+l+'</text>';}).join("");
  var leg=series.map(function(s,i){return '<g transform="translate('+(pad.l+i*120)+','+(pad.t-8)+')"><rect width="10" height="10" fill="'+s.cor+'"/><text x="16" y="9" class="svg-axis">'+s.nome+'</text></g>';}).join("");
  host.innerHTML='<svg viewBox="0 0 '+W+' '+H+'">'+leg+linhas+eixos+'</svg>';
}
function renderGraficos(){
  var mes=$("dash-mes").value||"todos";
  var base=filtrado();
  svgDonut($("ch-cat"),agrupar(base,function(l){return l.categoria;}),function(v){aplicarFiltro("categoria",v);});
  svgDonut($("ch-sub"),agrupar(base,function(l){return l.subcategoria;}).slice(0,8),function(v){aplicarFiltro("sub",v);});

  var cats={};
  base.forEach(function(l){if(l.tipo==="Despesa")cats[l.categoria]=1;});
  var lista=Object.keys(cats).sort();
  var cred=lista.map(function(c){
    return soma(base.filter(function(l){return l.tipo==="Despesa"&&l.categoria===c&&l.forma==="Cartão de Crédito";}),"valor");
  });
  var deb=lista.map(function(c){
    return soma(base.filter(function(l){return l.tipo==="Despesa"&&l.categoria===c&&l.forma!=="Cartão de Crédito";}),"valor");
  });
  svgEmpilhadas($("ch-stack"),lista,cred,deb);

  svgDonut($("ch-forma"),agrupar(base,function(l){return l.forma;}),function(v){aplicarFiltro("forma",v);});

  var cart=agrupar(base.filter(function(l){return l.forma==="Cartão de Crédito"&&l.cartao;}),function(l){return l.cartao;},false);
  if(cart.length)svgBarras($("ch-cartao"),cart.map(function(c){return c[0];}),cart.map(function(c){return c[1];}),"#3b82f6");
  else $("ch-cartao").innerHTML='<p class="muted-txt">Nenhuma fatura de crédito no período.</p>';

  var ms=mesesDisponiveis();
  var todos=todosLancamentos();
  var desp=ms.map(function(m){
    return soma(todos.filter(function(l){return l.tipo==="Despesa"&&String(l.mes).indexOf(m)===0;}),"valor");
  });
  var rec=ms.map(function(m){
    return soma(todos.filter(function(l){return l.tipo==="Receita"&&String(l.mes).indexOf(m)===0;}),"valor");
  });
  svgLinha($("ch-linha"),ms.map(function(m){return MESES[+m.slice(5,7)-1].slice(0,3);}),
    [{nome:"Despesas",cor:"#ef4444",valores:desp},{nome:"Receitas",cor:"#22c55e",valores:rec}],
    mes==="todos"?-1:ms.indexOf(mes));
}
function renderConferencia(){
  var todos=todosLancamentos();
  var ms=mesesDisponiveis();
  if(!ms.length){$("conf-mes").innerHTML='<p class="muted-txt">Sem lançamentos.</p>';return;}
  var linhas=ms.map(function(m){
    var base=todos.filter(function(l){return String(l.mes).indexOf(m)===0;});
    var d=soma(base.filter(function(l){return l.tipo==="Despesa";}),"valor");
    var r=soma(base.filter(function(l){return l.tipo==="Receita";}),"valor");
    return '<tr><td>'+mesLabel(m)+'</td><td class="num">'+base.length+'</td><td class="num neg">'+brl(d)+'</td><td class="num pos">'+brl(r)+'</td><td class="num '+(r-d<0?"neg":"pos")+'">'+brl(r-d)+'</td></tr>';
  }).join("");
  $("conf-mes").innerHTML='<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th class="num">Qtd</th><th class="num">Despesas</th><th class="num">Receitas</th><th class="num">Saldo</th></tr></thead><tbody>'+linhas+'</tbody></table></div>';
}
function renderChip(){
  var h=$("chip-filtro");
  if(!filtroDash.tipo){h.innerHTML="";return;}
  var rot=filtroDash.tipo==="categoria"?"Categoria":filtroDash.tipo==="forma"?"Forma":"Subcategoria";
  h.innerHTML='<span class="tag tag-blue">'+rot+': '+esc(filtroDash.valor)+' <button class="btn-ico" data-limpar style="color:#93c5fd">✕</button></span>';
}
function aplicarFiltro(tipo,valor){
  filtroDash={tipo:tipo,valor:valor};
  renderDashboard();
  toast("Filtro: "+valor);
}
function limparFiltro(){filtroDash={tipo:null,valor:null};renderDashboard();}
function renderDashboard(){
  if(!dados)return;
  renderAlerta();
  renderKPIs();
  renderInsights();
  renderGraficos();
  renderChip();
  renderConferencia();
}

function renderHub(){
  var t=todosLancamentos();
  $("hub-total").textContent=t.length;
  $("hub-nome").textContent=cfg.usuario?cfg.usuario.charAt(0).toUpperCase()+cfg.usuario.slice(1):"Maik";
  $("hub-conexao").innerHTML='<span class="pos">conectado</span>';
  $("hub-sync").textContent=ultimaLeitura?ultimaLeitura.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"—";
  var ms=mesesDisponiveis();
  var m=ms.length?ms[ms.length-1]:null;
  if(m){
    var base=baseMes(m);
    var saldo=soma(base.filter(function(l){return l.tipo==="Receita";}),"valor")-soma(base.filter(function(l){return l.tipo==="Despesa";}),"valor");
    $("hub-saldo").textContent=brl(saldo);
    $("hub-saldo").className="val "+(saldo<0?"neg":"pos");
    $("hub-mes").textContent=mesLabel(m);
  }
  setHub("Base única na planilha · "+t.length+" lançamentos");
}

function mostrarView(nome){
  ["hub","financeiro","ajustes"].forEach(function(v){$("view-"+v).classList.toggle("hidden",v!==nome);});
  document.querySelectorAll(".bottom-nav .nav-item").forEach(function(b){b.classList.toggle("active",b.dataset.nav===nome);});
  window.scrollTo(0,0);
  if(nome==="ajustes")atualizarDiagnostico();
  if(nome==="hub")renderHub();
  if(nome==="financeiro"){renderHistorico();renderDashboard();}
}
function entrarNoApp(){
  $("tela-login").classList.add("hidden");
  $("tela-setup").classList.add("hidden");
  $("tela-app").classList.remove("hidden");
  mostrarView("hub");
  carregar(true).catch(function(e){setHub("Erro ao ler a planilha: "+e.message);});
}
function sair(){
  try{localStorage.removeItem(LS_SESSAO);}catch(e){}
  dados=null;
  $("tela-app").classList.add("hidden");
  $("tela-login").classList.remove("hidden");
  $("login-senha").value="";
  toast("Sessão encerrada");
}

function iniciarLogin(){
  $("tela-setup").classList.add("hidden");
  $("tela-app").classList.add("hidden");
  $("tela-login").classList.remove("hidden");
  $("login-usuario").value=cfg.usuario||"maik";
  setTimeout(function(){$("login-senha").focus();},80);
}
function tentarLogin(e){
  e.preventDefault();
  var u=$("login-usuario").value.trim(),s=$("login-senha").value.trim();
  var box=$("login-erro"),btn=$("btn-entrar");
  if(!u||!s){box.textContent="Preencha usuário e senha.";box.classList.remove("hidden");return;}
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Verificando…';
  var tokenAntes=cfg.token;
  cfg.token=s;
  chamarGET({acao:"ler",token:s}).then(function(j){
    if(!j.ok)throw new Error(j.erro==="token"?"Senha incorreta.":(j.erro||"Falha na conexão."));
    cfg.usuario=u;cfg.token=s;gravarCfg();
    dados=j;
    ultimaLeitura=new Date();
    try{localStorage.setItem(LS_SESSAO,JSON.stringify({usuario:u,em:Date.now()}));}catch(x){}
    box.classList.add("hidden");
    aplicarDicionario();preencherOpcoes();
    entrarNoApp();
  }).catch(function(err){
    cfg.token=tokenAntes;
    box.textContent=err.message;
    box.classList.remove("hidden");
  }).then(function(){
    btn.disabled=false;btn.textContent="Entrar";
  });
}

function testarESalvarSetup(e){
  e.preventDefault();
  var url=$("s-url").value.trim(),user=$("s-user").value.trim(),tok=$("s-token").value.trim();
  var box=$("setup-erro"),btn=$("s-btn");
  if(!urlValida(url)){
    box.textContent="URL inválida. Ela deve começar com https:// e terminar em /exec.";
    box.classList.remove("hidden");return;
  }
  if(!tok){box.textContent="Cole o token que apareceu no editor do Apps Script.";box.classList.remove("hidden");return;}
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Testando…';
  var backup={url:cfg.url,token:cfg.token,usuario:cfg.usuario};
  cfg.url=url;cfg.token=tok;cfg.usuario=user||"maik";
  chamarGET({acao:"ler",token:tok}).then(function(j){
    if(!j.ok)throw new Error(j.erro==="token"?"Token recusado pela planilha. Confira se copiou o token inteiro.":(j.erro||"Falha na leitura."));
    gravarCfg();
    dados=j;ultimaLeitura=new Date();
    try{localStorage.setItem(LS_SESSAO,JSON.stringify({usuario:cfg.usuario,em:Date.now()}));}catch(x){}
    box.classList.add("hidden");
    aplicarDicionario();preencherOpcoes();
    entrarNoApp();
    toast("Conectado — "+j.lancamentos.length+" lançamentos lidos","ok");
  }).catch(function(err){
    cfg.url=backup.url;cfg.token=backup.token;cfg.usuario=backup.usuario;
    box.textContent=err.message;
    box.classList.remove("hidden");
  }).then(function(){
    btn.disabled=false;btn.textContent="Testar e salvar";
  });
}

function atualizarDiagnostico(){
  var linhas=[
    ["URL configurada",cfg.url?'<span class="pos">sim</span>':'<span class="neg">não</span>'],
    ["Senha (token)",cfg.token?"••••••••":'<span class="neg">vazia</span>'],
    ["Usuário",esc(cfg.usuario)],
    ["Planilha",dados?'<span class="pos">conectada</span>':'<span class="neg">não lida</span>'],
    ["Lançamentos na base",dados?todosLancamentos().length:"—"],
    ["Categorias",dados?Object.keys(dados.categorias||{}).length:"—"],
    ["Cartões",dados?((dados.cartoes||[]).length):"—"],
    ["Versão da API",dados?esc(dados.versao||"—"):"—"],
    ["Última leitura",ultimaLeitura?ultimaLeitura.toLocaleString("pt-BR"):"—"]
  ];
  $("diag-corpo").innerHTML=linhas.map(function(l){
    return "<tr><td>"+l[0]+"</td><td style='text-align:right'>"+l[1]+"</td></tr>";
  }).join("");
  $("c-url").value=cfg.url;
  $("c-user").value=cfg.usuario;
}
function salvarConn(){
  var url=$("c-url").value.trim(),user=$("c-user").value.trim();
  var msg=$("conn-msg");
  if(!urlValida(url)){
    msg.className="err-msg";msg.textContent="URL inválida. Deve começar com https:// e terminar em /exec.";msg.classList.remove("hidden");return;
  }
  cfg.url=url;cfg.usuario=user||"maik";gravarCfg();
  msg.className="notice-info";msg.textContent="Testando…";msg.classList.remove("hidden");
  carregar(true).then(function(j){
    msg.className="notice-ok";
    msg.textContent="Conectado. "+j.lancamentos.length+" lançamentos lidos da planilha.";
    atualizarDiagnostico();
  }).catch(function(e){
    msg.className="err-msg";
    msg.textContent=e.message;
  });
}
function trocarSenha(e){
  e.preventDefault();
  var a=$("p-atual").value.trim(),n=$("p-nova").value.trim(),c=$("p-conf").value.trim();
  var msg=$("senha-msg");
  function erro(t){msg.className="err-msg";msg.textContent=t;msg.classList.remove("hidden");}
  if(a!==cfg.token)return erro("A senha atual está incorreta.");
  if(n.length<8)return erro("A nova senha (token) deve ter pelo menos 8 caracteres.");
  if(n!==c)return erro("A confirmação não confere.");
  var backup=cfg.token;
  cfg.token=n;
  chamarGET({acao:"ler",token:n}).then(function(j){
    if(!j.ok)throw new Error("O novo token foi recusado pela planilha.");
    gravarCfg();
    msg.className="notice-ok";
    msg.textContent="Senha alterada e validada contra a planilha.";
    $("form-senha").reset();
    atualizarDiagnostico();
  }).catch(function(err){
    cfg.token=backup;
    erro(err.message);
  });
}
function exportar(){
  var blob=new Blob([JSON.stringify({exportado_em:new Date().toISOString(),config:{url:cfg.url,usuario:cfg.usuario},dados:dados},null,2)],{type:"application/json"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="ml-solucoes-backup.json";
  a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  toast("Backup exportado","ok");
}

function bind(){
  lerCfg();

  $("form-setup").addEventListener("submit",testarESalvarSetup);
  $("s-olho").addEventListener("click",function(){
    var i=$("s-token");i.type=i.type==="password"?"text":"password";
  });
  $("form-login").addEventListener("submit",tentarLogin);
  $("btn-olho").addEventListener("click",function(){
    var i=$("login-senha");i.type=i.type==="password"?"text":"password";
  });
  $("btn-config").addEventListener("click",function(){
    $("tela-login").classList.add("hidden");
    $("tela-setup").classList.remove("hidden");
    $("s-url").value=cfg.url;$("s-user").value=cfg.usuario;$("s-token").value=cfg.token;
  });
  $("login-usuario").addEventListener("input",function(){$("login-erro").classList.add("hidden");});
  $("login-senha").addEventListener("input",function(){$("login-erro").classList.add("hidden");});

  document.addEventListener("click",function(ev){
    var nav=ev.target.closest("[data-nav]");
    if(nav){
      var d=nav.dataset.nav;
      if(d==="sair")sair();
      else mostrarView(d);
      return;
    }
    var tab=ev.target.closest("[data-fin-tab]");
    if(tab){
      var t=tab.dataset.finTab;
      document.querySelectorAll("[data-fin-tab]").forEach(function(b){b.classList.toggle("active",b===tab);});
      ["lancamento","historico","dashboard"].forEach(function(n){$("fin-"+n).classList.toggle("hidden",n!==t);});
      if(t==="historico")renderHistorico();
      if(t==="dashboard")renderDashboard();
      return;
    }
    var ed=ev.target.closest("[data-edit]");
    if(ed){abrirEditar(ed.dataset.edit);return;}
    var dl=ev.target.closest("[data-del]");
    if(dl){abrirExcluir(dl.dataset.del);return;}
    if(ev.target.closest("[data-limpar]")){limparFiltro();return;}
    var fc=ev.target.closest("[data-fechar]");
    if(fc){$(fc.dataset.fechar).classList.remove("open");return;}
  });

  $("hub-financeiro").addEventListener("click",function(){mostrarView("financeiro");});
  $("t-desp").addEventListener("click",function(){setTipo("despesa");});
  $("t-rec").addEventListener("click",function(){setTipo("receita");});
  $("l-cat").addEventListener("change",function(){preencherSubs("l-cat","l-sub");atualizarAuto();});
  ["l-data","l-forma","l-cartao"].forEach(function(id){$(id).addEventListener("change",atualizarAuto);});
  $("l-data").addEventListener("input",atualizarAuto);
  $("form-lanc").addEventListener("submit",lancar);
  $("l-valor").addEventListener("input",function(){$("lanc-erro").classList.add("hidden");});

  $("h-mes").addEventListener("change",renderHistorico);
  $("h-busca").addEventListener("input",renderHistorico);
  $("dash-mes").addEventListener("change",function(){filtroDash={tipo:null,valor:null};renderDashboard();});
  $("btn-atualizar").addEventListener("click",function(){
    var b=$("btn-atualizar");
    b.disabled=true;b.innerHTML='<span class="spinner"></span>';
    carregar(true).then(function(){toast("Atualizado da planilha","ok");})
      .catch(function(e){toast(e.message,"erro");})
      .then(function(){b.disabled=false;b.textContent="↻ Atualizar";});
  });

  $("e-cat").addEventListener("change",function(){preencherSubs("e-cat","e-sub");});
  $("e-forma").addEventListener("change",atualizarAutoEditar);
  $("form-editar").addEventListener("submit",salvarEdicao);
  $("btn-confirmar-exc").addEventListener("click",confirmarExclusao);

  $("btn-salvar-conn").addEventListener("click",salvarConn);
  $("btn-testar").addEventListener("click",salvarConn);
  $("form-senha").addEventListener("submit",trocarSenha);
  $("btn-reler").addEventListener("click",function(){
    var m=$("diag-msg");
    m.className="notice-info";m.textContent="Lendo…";m.classList.remove("hidden");
    carregar(true).then(function(j){
      m.className="notice-ok";m.textContent="Lido: "+j.lancamentos.length+" lançamentos.";
      atualizarDiagnostico();
    }).catch(function(e){m.className="err-msg";m.textContent=e.message;});
  });
  $("btn-exportar").addEventListener("click",exportar);

  document.querySelectorAll(".modal").forEach(function(m){
    m.addEventListener("click",function(e){if(e.target===m)m.classList.remove("open");});
  });

  $("l-data").value=hojeISO();
  if(!configurado()){
    $("tela-setup").classList.remove("hidden");
    $("s-url").value=cfg.url;$("s-user").value=cfg.usuario;
    return;
  }
  var sessao=null;
  try{sessao=JSON.parse(localStorage.getItem(LS_SESSAO)||"null");}catch(e){sessao=null;}
  if(sessao&&sessao.usuario){
    cfg.usuario=sessao.usuario;
    entrarNoApp();
  }else{
    iniciarLogin();
  }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);
else bind();
})();
