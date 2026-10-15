/* Vor-/Nachtest: Auswahl und Bearbeitungsstand bleiben pro SCORM-Versuch stabil. */
var TEST_MODE = window.TEST_MODE === 'pretest' ? 'pretest' : 'posttest';
var TEST_SIZE = 8;
var S = null;
var pendingChoice = null;

function $(id){ return document.getElementById(id); }
function showScreen(id){ ['start-screen','email-screen','results-screen'].forEach(function(s){ $(s).style.display = s === id ? 'block' : 'none'; }); }
function currentEmail(){ return EMAILS.find(function(e){ return e.id === S.selected[S.idx]; }); }
function isPosttest(){ return TEST_MODE === 'posttest'; }

function hashString(text){ var h=2166136261; for(var i=0;i<text.length;i++){ h^=text.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rng(seed){ return function(){ seed = (Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296; }; }
function shuffled(items, random){ var a=items.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }

function makeAttempt(){
  var studentId = SCORM.getStudentId() || ('preview-'+Math.random().toString(36).slice(2));
  var random = rng(hashString(studentId+'|'+TEST_MODE+'|phishing-test-v4'));
  var phishing = EMAILS.filter(function(e){ return e.isPhishing; });
  var legitimate = EMAILS.filter(function(e){ return !e.isPhishing; });
  var phishingCount = 3 + Math.floor(random()*5); // 3 bis 7
  var picked = shuffled(phishing,random).slice(0,phishingCount).concat(shuffled(legitimate,random).slice(0,TEST_SIZE-phishingCount));
  return { version:4, mode:TEST_MODE, studentKey:hashString(studentId).toString(36), selected:shuffled(picked,random).map(function(e){return e.id;}), idx:0, answers:[], done:false };
}

function loadAttempt(){
  SCORM.init();
  var saved = SCORM.getSuspendData();
  if(saved){ try { var parsed=JSON.parse(saved); if(parsed.version===4 && parsed.mode===TEST_MODE && parsed.selected && parsed.selected.length===TEST_SIZE){ return parsed; } } catch(e){} }
  if(!SCORM.available()) try { var local=JSON.parse(localStorage.getItem('phishing-'+TEST_MODE)); if(local && local.version===4 && local.selected.length===TEST_SIZE) return local; } catch(e){}
  return makeAttempt();
}
function persist(){ var value=JSON.stringify(S); SCORM.setSuspendData(value); SCORM.commit(); if(!SCORM.available()) try { localStorage.setItem('phishing-'+TEST_MODE,value); } catch(e){} }

function configureCopy(){
  var pre = !isPosttest();
  document.title = pre ? 'Phishing-Vortest' : 'Phishing-Nachtest';
  $('app-title').textContent = pre ? 'Phishing-Vortest – Kantonsschule Im Lee' : 'Phishing-Nachtest – Kantonsschule Im Lee';
  $('start-title').textContent = pre ? 'Phishing-Vortest' : 'Phishing-Nachtest';
  $('mode-badge').textContent = pre ? 'Vortest' : 'Nachtest';
  $('start-copy').textContent = pre ? 'Beurteilen Sie 8 E-Mails. Es gibt keine Hinweise und keine Einzelauflösung während des Tests.' : 'Beurteilen Sie 8 E-Mails und nennen Sie jeweils das wichtigste Erkennungsmerkmal. Lösungen und Tipps erscheinen erst am Schluss.';
  $('task-type-icon').textContent = pre ? '✓' : '3';
  $('task-type-label').textContent = pre ? 'Einordnung' : 'Punkte pro Mail';
  $('start-rules').innerHTML = pre ? '<strong>Regeln:</strong> Entscheiden Sie bei jeder Mail nur zwischen «Legitim» und «Phishing». Arbeiten Sie ohne Hilfe.' : '<strong>Regeln:</strong> Entscheiden Sie bei jeder Mail zwischen «Legitim» (3 Punkte) und «Phishing» (2 Punkte + 1 Punkt für das Merkmal). Während des Tests werden keine Lösungen angezeigt.';
}

function startSim(){
  if(S.done){ S=makeAttempt(); persist(); }
  loadEmail(); showScreen('email-screen'); updateProgress();
}
function loadEmail(){
  var e=currentEmail();
  $('email-counter').textContent=(S.idx+1)+' / '+TEST_SIZE;
  $('email-subject-display').textContent=e.subject; $('email-date-display').textContent=e.date; $('email-to-display').textContent=e.to;
  $('email-body-area').innerHTML=e.body;
  $('email-sender-cell').innerHTML='<span class="sender-name" id="sender-hover-target" title="Absenderadresse anzeigen">'+escHtml(e.senderDisplay)+'</span><span class="sender-real-badge" id="sender-real-badge" style="display:none"><span class="real-addr-label">Adresse:</span> '+escHtml(e.senderReal)+'</span>';
  $('sender-hover-target').addEventListener('mouseenter',revealSender);
  $('sender-hover-target').addEventListener('focus',revealSender);
  wireActionButtons();
  $('action-bar').innerHTML='<button class="btn btn-legit" onclick="chooseClassification(\'legit\')">✅ Legitim</button><button class="btn btn-phish" onclick="chooseClassification(\'phishing\')">🚨 Phishing</button>';
  $('next-btn').style.display='none';
}
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function revealSender(){ $('sender-real-badge').style.display='inline-flex'; $('sender-hover-target').classList.add('revealed'); }

function wireActionButtons(){
  var buttons = $('email-body-area').querySelectorAll('.email-action-link');
  buttons.forEach(function(btn){
    var targetUrl = btn.getAttribute('data-url') || (currentEmail() && currentEmail().linkUrl) || '';
    if(targetUrl){
      btn.title = 'Ziel-URL: ' + targetUrl;
    }
  });
}

function chooseClassification(choice){
  if(isPosttest() && choice === 'phishing') {
    pendingChoice = choice;
    openReason();
    return;
  }
  recordAnswer(choice, null);
}
function openReason(){
  var phishingKeys = ['sender', 'link', 'pressure'];
  var html='';
  phishingKeys.forEach(function(key,i){
    html+='<label class="reason-option"><input type="radio" name="reason" value="'+key+'" '+(i===0?'checked':'')+'><span>'+REASON_OPTIONS[key]+'</span></label>';
  });
  $('reason-options').innerHTML=html; $('reason-screen').style.display='block';
}
function cancelReason(){ pendingChoice=null; $('reason-screen').style.display='none'; }
function submitReason(){ var option=document.querySelector('input[name="reason"]:checked'); if(!option) return; $('reason-screen').style.display='none'; recordAnswer(pendingChoice,option.value); pendingChoice=null; }

function recordAnswer(choice,reason){
  var e=currentEmail();
  var classificationCorrect=(choice==='phishing')===e.isPhishing;
  var reasonCorrect=isPosttest() && classificationCorrect && e.isPhishing && (reason===e.reason);
  var points = 0;
  if(isPosttest()){
    if(classificationCorrect){
      if(!e.isPhishing){
        points = 3;
      } else {
        points = 2 + (reasonCorrect ? 1 : 0);
      }
    } else {
      points = 0;
    }
  } else {
    points = classificationCorrect ? 1 : 0;
  }
  S.answers.push({id:e.id, choice:choice, reason:reason, classificationCorrect:classificationCorrect, reasonCorrect:reasonCorrect, points:points});
  persist();
  $('action-bar').innerHTML=''; $('next-btn').style.display='inline-block';
  $('next-btn').textContent=S.idx+1<TEST_SIZE?'Nächste Mail →':'Auswertung →';
}
function nextEmail(){ S.idx++; persist(); if(S.idx>=TEST_SIZE){ S.done=true; persist(); showResults(); } else { loadEmail(); updateProgress(); } }
function updateProgress(){ var pct=(S.idx/TEST_SIZE)*100; $('progress-fill').style.width=pct+'%'; $('progress-label').textContent=S.idx+' von '+TEST_SIZE+' E-Mails beurteilt'; }

function showResults(){
  showScreen('results-screen'); updateProgress();
  var classified=S.answers.filter(function(a){return a.classificationCorrect;}).length;
  var points = S.answers.reduce(function(sum, a){
    if(typeof a.points === 'number') return sum + a.points;
    var e = EMAILS.find(function(x){return x.id === a.id;});
    if(!e || !a.classificationCorrect) return sum;
    if(isPosttest()){
      return sum + (!e.isPhishing ? 3 : (2 + (a.reasonCorrect ? 1 : 0)));
    }
    return sum + 1;
  }, 0);
  var max=isPosttest()?24:8;
  var pct=Math.round(points/max*100);
  $('res-score').textContent=points; $('res-max').textContent=max; $('res-pct').textContent=pct+'%'; $('res-correct').textContent=classified; $('res-total').textContent=TEST_SIZE;
  $('score-label').textContent=isPosttest()?'Gesamtpunktzahl':'richtige Einordnungen';
  $('results-title').textContent=isPosttest()?'🏁 Nachtest-Auswertung':'🏁 Vortest abgeschlossen';
  $('res-rating').textContent=isPosttest()?'Die Lösungen und Tipps stehen nun für die Nachbesprechung bereit.':'Ihr Ergebnis wurde an Moodle übermittelt. Die Erklärungen erfolgen im Unterricht.';
  $('details-title').style.display=isPosttest()?'block':'none'; $('tips-card').style.display=isPosttest()?'block':'none';
  var details=$('res-details'); details.innerHTML='';
  if(isPosttest()) S.answers.forEach(function(a){
    var e=EMAILS.find(function(x){return x.id===a.id;});
    var pts = typeof a.points === 'number' ? a.points : (!a.classificationCorrect ? 0 : (!e.isPhishing ? 3 : (2 + (a.reasonCorrect ? 1 : 0))));
    var isFull = pts === 3;
    var isPartial = pts === 2;
    var statusClass = isFull ? 'res-ok' : (isPartial ? 'res-partial' : 'res-fail');
    var icon = isFull ? '✅' : (isPartial ? '⚠️' : '❌');
    var div=document.createElement('div');
    div.className='res-item ' + statusClass;
    div.innerHTML='<span class="res-icon">'+icon+'</span>'+
      '<span class="res-subj">'+escHtml(e.subject)+'</span>'+
      '<span class="res-badge '+(e.isPhishing?'badge-p':'badge-l')+'">'+(e.isPhishing?'Phishing':'Legitim')+'</span>'+
      '<span class="res-pts">'+pts+' / 3 Pkt.</span>'+
      '<p style="width:100%;margin:7px 0 0 34px">'+e.explanation+'</p>';
    details.appendChild(div);
  });
  SCORM.finish(pct);
}

window.addEventListener('DOMContentLoaded',function(){ configureCopy(); S=loadAttempt(); if(S.done) showResults(); else { showScreen('start-screen'); updateProgress(); } });
