var ORIGIN={lat:31.8839,lng:34.6868};
var ISR={n:33.35,s:29.45,w:34.25,e:35.90};
var S={t:null,w:null,map:null,tm:null,om:null,pl:null,mm:null,tl:null,fly:false,dur:0,af:null};

var BM=["\u05DE\u05D0\u05EA\u05D7\u05DC \u05DE\u05E2\u05E8\u05DB\u05D5\u05EA...","\u05D8\u05D5\u05E2\u05DF GPS...","\u05DE\u05EA\u05D7\u05D1\u05E8 \u05DC\u05DC\u05D5\u05D5\u05D9\u05D9\u05E0\u05D9\u05DD...","\u05D1\u05D5\u05D3\u05E7 \u05E0\u05D9\u05D5\u05D5\u05D8...","\u05DE\u05D0\u05DE\u05EA \u05D4\u05E8\u05E9\u05D0\u05D5\u05EA...","\u05D8\u05D5\u05E2\u05DF \u05DE\u05E4\u05D4...","\u05DE\u05E2\u05E8\u05DB\u05EA \u05DE\u05D5\u05DB\u05E0\u05D4 \u2713"];

function runBootSequence(){
var bar=document.getElementById("bootBar"),st=document.getElementById("bootStatus"),step=0;
var iv=setInterval(function(){
if(step<BM.length){st.textContent=BM[step];bar.style.width=((step+1)/BM.length*100)+"%";step++;}
else{clearInterval(iv);setTimeout(function(){document.getElementById("boot-screen").style.opacity="0";
setTimeout(function(){document.getElementById("boot-screen").classList.add("hidden");
document.getElementById("main-app").classList.remove("hidden");initApp();},500);},400);}
},500);}

function initApp(){initMap();initClock();initEvents();}

function initMap(){
S.map=L.map("map",{center:[29,45],zoom:5,zoomControl:false,attributionControl:false});
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:18}).addTo(S.map);
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",{maxZoom:18}).addTo(S.map);
L.control.zoom({position:"topright"}).addTo(S.map);
S.om=L.marker([ORIGIN.lat,ORIGIN.lng],{icon:L.divIcon({className:"origin-marker-icon",html:"\uD83C\uDDEE\uD83C\uDDF1",iconSize:[30,30],iconAnchor:[15,15]})}).addTo(S.map);
S.om.bindTooltip("\u05D1\u05E1\u05D9\u05E1 \u05E9\u05D9\u05D2\u05D5\u05E8 - \u05D9\u05E9\u05E8\u05D0\u05DC",{permanent:false,direction:"top"});
S.map.on("click",function(e){if(!S.fly)handleClick(e.latlng.lat,e.latlng.lng);});
}

function isIL(a,b){return a>=ISR.s&&a<=ISR.n&&b>=ISR.w&&b<=ISR.e;}

function showILWarn(){var el=document.getElementById("israelWarning");el.classList.remove("hidden");setTimeout(function(){el.classList.add("hidden");},2500);}

function handleClick(lat,lng){
if(isIL(lat,lng)){showILWarn();return;}
S.t={lat:lat,lng:lng,name:"\u05D8\u05D5\u05E2\u05DF..."};
if(S.tm)S.tm.setLatLng([lat,lng]);
else{S.tm=L.marker([lat,lng],{icon:L.divIcon({className:"target-marker-icon",html:"\uD83C\uDFAF",iconSize:[35,35],iconAnchor:[17,17]})}).addTo(S.map);}
if(S.pl)S.map.removeLayer(S.pl);
S.pl=L.polyline([[ORIGIN.lat,ORIGIN.lng],[lat,lng]],{color:"#ef4444",weight:2,dashArray:"10 8",opacity:0.5}).addTo(S.map);
S.map.fitBounds(S.pl.getBounds(),{padding:[60,60]});
fetch("https://nominatim.openstreetmap.org/reverse?lat="+lat+"&lon="+lng+"&format=json&accept-language=he")
.then(function(r){return r.json();}).then(function(d){
var nm=lat.toFixed(4)+", "+lng.toFixed(4);
if(d&&d.display_name){var p=d.display_name.split(",");nm=p.length>=2?p[0].trim()+", "+p[p.length-1].trim():d.display_name;}
S.t.name=nm;document.getElementById("infoTarget").textContent=nm;
if(S.tm){S.tm.unbindTooltip();S.tm.bindTooltip(nm,{permanent:true,direction:"top",className:"target-tooltip"});}
}).catch(function(){S.t.name=lat.toFixed(4)+", "+lng.toFixed(4);document.getElementById("infoTarget").textContent=S.t.name;});
document.getElementById("infoCoords").textContent=lat.toFixed(4)+", "+lng.toFixed(4);
var dist=calcDist(ORIGIN.lat,ORIGIN.lng,lat,lng);
document.getElementById("infoDistance").textContent=Math.round(dist)+' \u05E7"\u05DE';
S.dur=calcFlightTime(dist);
var m=Math.floor(S.dur/60),s=S.dur%60;
document.getElementById("missionInfo").classList.remove("hidden");
document.getElementById("infoETA").textContent=m+":"+pz(s)+" \u05D3\u05E7\u05D5\u05EA";
updBtn();
}

function initClock(){var el=document.getElementById("clock");function u(){var n=new Date();el.textContent=pz(n.getHours())+":"+pz(n.getMinutes())+":"+pz(n.getSeconds());}u();setInterval(u,1000);}

function initEvents(){
var wb=document.querySelectorAll(".warhead-btn");
for(var i=0;i<wb.length;i++)(function(b){b.addEventListener("click",function(){selWH(b)});})(wb[i]);
document.getElementById("launchBtn").addEventListener("click",function(){if(!S.fly&&S.t&&S.w)showConf();});
document.getElementById("confirmYes").addEventListener("click",function(){hideConf();launch();});
document.getElementById("confirmNo").addEventListener("click",function(){hideConf();});
}

function selWH(b){
if(S.fly)return;
var a=document.querySelectorAll(".warhead-btn");for(var i=0;i<a.length;i++)a[i].classList.remove("active");
b.classList.add("active");
S.w={type:b.getAttribute("data-warhead"),power:parseInt(b.getAttribute("data-power")),name:b.querySelector(".wh-name").textContent,desc:b.querySelector(".wh-desc").textContent,len:b.getAttribute("data-length"),weight:b.getAttribute("data-weight"),range:b.getAttribute("data-range")};
document.getElementById("infoWarhead").textContent=S.w.name;
document.getElementById("missionInfo").classList.remove("hidden");updBtn();
}

function updBtn(){
var b=document.getElementById("launchBtn"),h=document.getElementById("launchHint");
if(S.t&&S.w){b.classList.remove("disabled");b.disabled=false;h.textContent="\u05DE\u05D5\u05DB\u05DF \u05DC\u05E9\u05D9\u05D2\u05D5\u05E8";h.style.color="#ef4444";}
else if(!S.t){h.textContent="\u05DC\u05D7\u05E5 \u05E2\u05DC \u05D4\u05DE\u05E4\u05D4 \u05DC\u05D1\u05D7\u05D9\u05E8\u05EA \u05D9\u05E2\u05D3";}
else{h.textContent="\u05D1\u05D7\u05E8 \u05E8\u05D0\u05E9 \u05E0\u05E4\u05E5";}
}

var cIv=null;
function showConf(){
document.getElementById("confirmOverlay").classList.remove("hidden");
document.getElementById("confirmText").innerHTML="\u05D4\u05D0\u05DD \u05DC\u05E9\u05D2\u05E8 \u05D8\u05D9\u05DC <strong>"+S.w.name+"</strong><br>\u05DC\u05E2\u05D1\u05E8 <strong>"+S.t.name+"</strong>?";
var cd=10,el=document.getElementById("confirmCountdown");el.textContent=cd;
cIv=setInterval(function(){cd--;el.textContent=cd;if(cd<=0){clearInterval(cIv);hideConf();}},1000);
}
function hideConf(){if(cIv)clearInterval(cIv);document.getElementById("confirmOverlay").classList.add("hidden");}

function launch(){
S.fly=true;
document.getElementById("launchBtn").classList.add("disabled");
document.getElementById("launchBtn").disabled=true;
document.getElementById("launchHint").textContent="\uD83D\uDE80 \u05D8\u05D9\u05DC \u05D1\u05D8\u05D9\u05E1\u05D4...";
document.getElementById("launchHint").style.color="#06b6d4";
document.getElementById("flightOverlay").classList.remove("hidden");
document.getElementById("flightTarget").textContent=S.t.name;
document.getElementById("flightETA").textContent=Math.floor(S.dur/60)+":"+pz(S.dur%60);
if(S.pl){S.map.removeLayer(S.pl);S.pl=null;}
var mIcon=L.icon({iconUrl:"missile.ico",iconSize:[32,32],iconAnchor:[16,16]});
S.mm=L.marker([ORIGIN.lat,ORIGIN.lng],{icon:mIcon,zIndexOffset:1000}).addTo(S.map);
var trail=[[ORIGIN.lat,ORIGIN.lng]];
S.tl=L.polyline(trail,{color:"#f97316",weight:3,opacity:0.7}).addTo(S.map);
var st=Date.now(),ms=S.dur*1000,lt=0;
function anim(){
var el=Date.now()-st,p=Math.min(el/ms,1),e=p<0.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
var cLat=ORIGIN.lat+(S.t.lat-ORIGIN.lat)*e,cLng=ORIGIN.lng+(S.t.lng-ORIGIN.lng)*e;
S.mm.setLatLng([cLat,cLng]);
var ang=bearing(cLat,cLng,S.t.lat,S.t.lng);
S.mm.setIcon(L.icon({iconUrl:"missile.ico",iconSize:[32,32],iconAnchor:[16,16],className:"missile-icon-rot"}));
if(el-lt>500){trail.push([cLat,cLng]);S.tl.setLatLngs(trail);lt=el;}
var rem=Math.max(0,S.dur-Math.floor(el/1000)),rm=Math.floor(rem/60),rs=rem%60;
document.getElementById("flightTimer").textContent=pz(rm)+":"+pz(rs);
document.getElementById("flightProgress").style.width=(p*100)+"%";
document.getElementById("flightETA").textContent=rm+":"+pz(rs);
if(Math.floor(el/5000)!==Math.floor((el-16)/5000))S.map.panTo([cLat,cLng],{animate:true,duration:2});
if(p<1)S.af=requestAnimationFrame(anim);else arrived();
}
S.af=requestAnimationFrame(anim);
}

function arrived(){
S.fly=false;document.getElementById("flightOverlay").classList.add("hidden");
if(S.mm){S.map.removeLayer(S.mm);S.mm=null;}
S.map.setView([S.t.lat,S.t.lng],8,{animate:true,duration:1});
var rad=[5000,15000,30000],col=["#ff0000","#ff6600","#ffaa00"],circles=[];
for(var i=0;i<3;i++)(function(idx){setTimeout(function(){
circles.push(L.circle([S.t.lat,S.t.lng],{radius:rad[idx]*S.w.power,color:col[idx],fillColor:col[idx],fillOpacity:0.15,weight:2}).addTo(S.map));
},idx*400);})(i);
var em=L.marker([S.t.lat,S.t.lng],{icon:L.divIcon({className:"explosion-marker",html:"\uD83D\uDCA5",iconSize:[60,60],iconAnchor:[30,30]}),zIndexOffset:2000}).addTo(S.map);
document.getElementById("explosionOverlay").classList.remove("hidden");
document.getElementById("explosionDetails").innerHTML="\u05D8\u05D9\u05DC "+S.w.name+" \u05E4\u05D2\u05E2 \u05D1-"+S.t.name+"<br>\u05E8\u05D0\u05E9 \u05E0\u05E4\u05E5: "+S.w.desc;
setTimeout(function(){document.getElementById("explosionOverlay").classList.add("hidden");
setTimeout(function(){if(S.tl){S.map.removeLayer(S.tl);S.tl=null;}
S.map.removeLayer(em);for(var i=0;i<circles.length;i++)S.map.removeLayer(circles[i]);
if(S.tm){S.map.removeLayer(S.tm);S.tm=null;}reset();},1000);},6000);
}

function reset(){
S.t=null;S.w=null;S.fly=false;
var a=document.querySelectorAll(".warhead-btn");for(var i=0;i<a.length;i++)a[i].classList.remove("active");
document.getElementById("missionInfo").classList.add("hidden");
document.getElementById("infoCoords").textContent="-";
document.getElementById("infoTarget").textContent="-";
document.getElementById("infoDistance").textContent="-";
document.getElementById("launchBtn").classList.add("disabled");
document.getElementById("launchBtn").disabled=true;
document.getElementById("launchHint").textContent="\u05D1\u05D7\u05E8 \u05D9\u05E2\u05D3 \u05D5\u05E8\u05D0\u05E9 \u05E0\u05E4\u05E5 \u05DC\u05E9\u05D9\u05D2\u05D5\u05E8";
document.getElementById("launchHint").style.color="";
S.map.setView([29,45],5,{animate:true,duration:1.5});
}

function calcDist(a,b,c,d){var R=6371,dL=rad(c-a),dN=rad(d-b),x=Math.sin(dL/2)*Math.sin(dL/2)+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dN/2)*Math.sin(dN/2);return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function bearing(a,b,c,d){var dL=rad(d-b),y=Math.sin(dL)*Math.cos(rad(c)),x=Math.cos(rad(a))*Math.sin(rad(c))-Math.sin(rad(a))*Math.cos(rad(c))*Math.cos(dL);return(deg(Math.atan2(y,x))+360)%360;}
function rad(d){return d*Math.PI/180;}
function deg(r){return r*180/Math.PI;}
function pz(n){return n<10?"0"+n:""+n;}
function calcFlightTime(distKm){if(distKm<100)return 60+Math.floor(Math.random()*61);if(distKm<500)return 90+Math.floor(Math.random()*31);if(distKm<1000)return 120+Math.floor(Math.random()*31);if(distKm<2000)return 150+Math.floor(Math.random()*31);return 150+Math.floor(Math.random()*31);}

document.addEventListener("DOMContentLoaded",runBootSequence);
