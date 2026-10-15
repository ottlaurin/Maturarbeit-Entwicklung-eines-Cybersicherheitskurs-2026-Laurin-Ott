/* Kleiner SCORM-1.2-Adapter mit sicherem Browser-Vorschau-Fallback. */
var SCORM=(function(){
  var A=null, initialized=false;
  function findApi(w){ var tries=0; while(!w.API&&w.parent&&w.parent!==w&&tries++<10) w=w.parent; return w.API||null; }
  function init(){ if(initialized) return true; A=findApi(window); if(!A&&window.opener) A=findApi(window.opener); if(!A) return false; try { var result=A.LMSInitialize(''); initialized=result==='true'||result===true; } catch(e){ initialized=false; } return initialized; }
  function get(key){ if(!A) return ''; try{return A.LMSGetValue(key)||'';}catch(e){return '';} }
  function set(key,value){ if(!A) return false; try{return A.LMSSetValue(key,String(value))==='true';}catch(e){return false;} }
  function commit(){ if(A) try{A.LMSCommit('');}catch(e){} }
  function getStudentId(){ return get('cmi.core.student_id'); }
  function getSuspendData(){ return get('cmi.suspend_data'); }
  function setSuspendData(value){ set('cmi.suspend_data',value); }
  function finish(score){ if(!A) return; set('cmi.core.score.raw',score); set('cmi.core.score.min','0'); set('cmi.core.score.max','100'); set('cmi.core.lesson_status','completed'); commit(); }
  function available(){ return !!A && initialized; }
  return {init:init,available:available,commit:commit,getStudentId:getStudentId,getSuspendData:getSuspendData,setSuspendData:setSuspendData,finish:finish};
})();
window.addEventListener('load',function(){SCORM.init();});
window.addEventListener('beforeunload',function(){SCORM.commit();});
