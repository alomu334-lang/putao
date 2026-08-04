/* 攒钱罐·网页版 数据层（localStorage 持久化，逻辑与小程序一致） */
(function (global) {
  var KEY = 'zqg_web_v1';

  function pad(n){return n<10?'0'+n:''+n;}
  function today(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function yesterday(){var d=new Date();d.setDate(d.getDate()-1);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
  function yuan(n){n=Number(n)||0;return '¥'+n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function round2(n){return Math.round(n*100)/100;}

  var PRAISE = [
    '今天又省下一笔，自律的你最帅！💪',
    '钱是攒出来的，你今天又赢了昨天的自己 🎉',
    '少花一块，多存一块，离愿望更近一步 🌟',
    '克制是一种超能力，你刚刚用了一遍 ✨',
    '今天的你，比昨天更有钱了 💰',
    '没乱花就是赚到，继续保持这股劲 🔥'
  ];

  function defaultState(){
    return {
      dailyBudget:0, budgetDate:'', carryOverEnabled:true, savingsAuto:true, carryBase:0,
      savings:0, penaltyPool:0, penaltyRate:0.2,
      strictLimit:50,                      // 重点类目(奶茶/炸鸡/游戏)每日总限额
      categories:[
        {key:'food',name:'餐饮',icon:'🍜'},
        {key:'milktea',name:'奶茶',icon:'🧋',strict:true},
        {key:'fried',name:'炸鸡',icon:'🍗',strict:true},
        {key:'game',name:'游戏',icon:'🎮',strict:true},
        {key:'shopping',name:'购物',icon:'🛍️'},
        {key:'transport',name:'交通',icon:'🚌'},
        {key:'fun',name:'娱乐',icon:'🎡'},
        {key:'life',name:'生活',icon:'🏠'},
        {key:'study',name:'学习',icon:'📚'},
        {key:'other',name:'其他',icon:'📦'}
      ],
      records:[],
      goals:[],
      wishes:[],
      penalties:[],
      streak:0, lastCheckin:'',
      lastEncourage:null,   // {date, saved} 用于次日打开时鼓励
      encourageShown:''
    };
  }

  function getState(){
    var s;
    try{ s = JSON.parse(localStorage.getItem(KEY)); }catch(e){ s=null; }
    if(!s||typeof s!=='object') return defaultState();
    var d=defaultState(); for(var k in d){ if(!(k in s)) s[k]=d[k]; }
    return s;
  }
  function save(s){ localStorage.setItem(KEY, JSON.stringify(s)); }

  function isStrict(s,catKey){var c=s.categories.find(function(x){return x.key===catKey;});return !!(c&&c.strict);}
  function sumExpenseOn(s,date){return s.records.filter(function(r){return r.type==='expense'&&r.date===date;}).reduce(function(a,r){return a+r.amount;},0);}
  function todayStrictUsed(s){var t=today();return s.records.filter(function(r){return r.type==='expense'&&r.date===t&&isStrict(s,r.catKey);}).reduce(function(a,r){return a+r.amount;},0);}

  /* 跨天结转 + 记录昨日结余用于鼓励 */
  function rollover(){
    var s=getState(), t=today();
    if(s.budgetDate && s.budgetDate!==t){
      var yExp=sumExpenseOn(s,s.budgetDate);
      var yLeft=Math.max(0,(s.dailyBudget+s.carryBase)-yExp);
      if(s.savingsAuto) s.savings+=yLeft;
      if(yLeft>0) s.lastEncourage={date:s.budgetDate,saved:yLeft};
      s.carryBase=s.carryOverEnabled?yLeft:0;
      s.dailyBudget=0; s.budgetDate='';
      save(s);
    } else if(!s.budgetDate){ s.carryBase=0; }
    checkUnlocks();
    return s;
  }

  function setDailyBudget(amount){
    var s=getState(); s.dailyBudget=Math.max(0,Number(amount)||0); s.budgetDate=today(); save(s); return s;
  }
  function todayBudget(){var s=getState();return s.budgetDate===today()?s.dailyBudget+s.carryBase:0;}
  function todayUsed(){return sumExpenseOn(getState(),today());}
  function todayLeft(){return Math.max(0,todayBudget()-todayUsed());}

  /* 记一笔 + 超支拦截/罚金 + 重点类目管控 */
  function tryExpense(catKey,amount,note){
    amount=round2(Number(amount)||0);
    if(amount<=0) return {ok:false,msg:'金额必须大于0'};
    var s=getState(), left=todayLeft();

    if(amount>left){
      var overflow=round2(amount-left);
      var penalty=Math.max(1,round2(overflow*s.penaltyRate));
      return {ok:false,blocked:true,overflow:overflow,penalty:penalty,total:amount};
    }
    // 重点类目：检查当日限额
    if(isStrict(s,catKey)){
      var newStrict=todayStrictUsed(s)+amount;
      if(newStrict>s.strictLimit){
        var sover=round2(newStrict-s.strictLimit);
        var spen=Math.max(1,round2(sover*s.penaltyRate));
        return {ok:false,blocked:true,strict:true,overflow:sover,penalty:spen,
                total:amount,strictLimit:s.strictLimit,strictUsed:todayStrictUsed(s)};
      }
    }
    s.records.unshift({id:uid(),date:today(),type:'expense',catKey:catKey,amount:amount,note:note||'',ts:Date.now(),strict:isStrict(s,catKey)});
    save(s);
    return {ok:true,left:todayLeft()};
  }

  function payPenalty(overflow,penalty){
    var s=getState();
    s.penalties.unshift({id:uid(),date:today(),overflow:overflow,penalty:penalty,ts:Date.now()});
    s.penaltyPool+=penalty; s.savings+=penalty;
    save(s); checkUnlocks();
    return s;
  }
  function addIncome(amount,note){
    var s=getState(); s.records.unshift({id:uid(),date:today(),type:'income',catKey:'income',amount:Math.max(0,Number(amount)||0),note:note||'收入',ts:Date.now()});
    save(s); return s;
  }
  function deleteRecord(id){var s=getState();s.records=s.records.filter(function(r){return r.id!==id;});save(s);return s;}

  /* 目标 */
  function plan52(unit){var a=[];for(var i=1;i<=52;i++)a.push(i*(unit||10));return a;}
  function plan365(){var a=[];for(var i=1;i<=365;i++)a.push(i);for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function createGoal(opt){
    var s=getState(); var g={id:uid(),name:opt.name||'存钱目标',method:opt.method||'custom',unit:opt.unit||10,target:0,saved:0,deadline:opt.deadline||'',plan:[],done:[],createdAt:Date.now()};
    if(g.method==='52week'){g.plan=plan52(g.unit);g.target=g.plan.reduce(function(a,b){return a+b;},0);}
    else if(g.method==='365day'){g.plan=plan365();g.target=g.plan.reduce(function(a,b){return a+b;},0);}
    else g.target=Math.max(0,Number(opt.target)||0);
    s.goals.unshift(g); save(s); return g;
  }
  function contributeGoal(id,amount){
    var s=getState(); var g=s.goals.find(function(x){return x.id===id;}); if(!g)return null;
    g.saved+=Math.max(0,Number(amount)||0); s.savings+=Math.max(0,Number(amount)||0);
    save(s); checkUnlocks(); return g;
  }
  function markPlanDone(id,idx,checked){
    var s=getState(); var g=s.goals.find(function(x){return x.id===id;}); if(!g)return null;
    if(!g.done)g.done=[];
    if(checked){ if(g.done.indexOf(idx)<0){g.done.push(idx);g.saved+=g.plan[idx];s.savings+=g.plan[idx];} }
    else{ var i=g.done.indexOf(idx); if(i>=0){g.done.splice(i,1);g.saved-=g.plan[idx];s.savings-=g.plan[idx];} }
    save(s); checkUnlocks(); return g;
  }
  function deleteGoal(id){var s=getState();s.goals=s.goals.filter(function(g){return g.id!==id;});save(s);return s;}

  /* 愿望清单 */
  function createWish(name,cost,icon){
    var s=getState(); var w={id:uid(),name:name,cost:Math.max(0,Number(cost)||0),icon:icon||'🎁',unlocked:false,ts:Date.now()};
    s.wishes.unshift(w); save(s);
    var newly=checkUnlocks();
    // checkUnlocks() re-reads state (fresh objects after JSON round-trip), so return the
    // freshly-unlocked wish rather than the stale local reference.
    var freshW=newly.length?newly[0]:(getState().wishes.find(function(x){return x.id===w.id;})||w);
    return {wish:freshW,unlocked:newly};
  }
  function deleteWish(id){var s=getState();s.wishes=s.wishes.filter(function(w){return w.id!==id;});save(s);return s;}
  function checkUnlocks(){
    var s=getState(), newly=[];
    s.wishes.forEach(function(w){ if(!w.unlocked && s.savings>=w.cost && w.cost>0){ w.unlocked=true; w.unlockedAt=Date.now(); newly.push(w);} });
    if(newly.length) save(s);
    return newly;
  }

  /* 打卡 */
  function checkin(){
    var s=getState(), t=today();
    if(s.lastCheckin===t) return s;
    if(s.lastCheckin===yesterday()) s.streak+=1; else s.streak=1;
    s.lastCheckin=t; save(s); return s;
  }

  /* 设置 */
  function updateSettings(patch){var s=getState();for(var k in patch)s[k]=patch[k];save(s);return s;}
  function setStrictLimit(v){var s=getState();s.strictLimit=Math.max(0,Number(v)||0);save(s);return s;}

  /* 统计 */
  function stats(){
    var s=getState(), t=today(), ym=t.slice(0,7);
    var monthExp=s.records.filter(function(r){return r.type==='expense'&&r.date.slice(0,7)===ym;});
    var monthTotal=monthExp.reduce(function(a,r){return a+r.amount;},0);
    var byCat={}; monthExp.forEach(function(r){byCat[r.catKey]=(byCat[r.catKey]||0)+r.amount;});
    var catList=Object.keys(byCat).map(function(k){var c=s.categories.find(function(x){return x.key===k;});return {key:k,name:c?c.name:'其他',icon:c?c.icon:'📦',amount:byCat[k]};}).sort(function(a,b){return b.amount-a.amount;});
    var trend=[]; for(var i=6;i>=0;i--){var d=new Date();d.setDate(d.getDate()-i);var ds=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());trend.push({date:ds.slice(5),amount:sumExpenseOn(s,ds)});}
    return {monthTotal:monthTotal,catList:catList,trend:trend,savings:s.savings,penaltyPool:s.penaltyPool,
      totalExpense:s.records.filter(function(r){return r.type==='expense';}).reduce(function(a,r){return a+r.amount;},0)};
  }

  /* 鼓励语 */
  function praise(){return PRAISE[Math.floor(Math.random()*PRAISE.length)];}
  function consumeEncourage(){
    var s=getState();
    if(s.lastEncourage && s.lastEncourage.date!==s.encourageShown && s.lastEncourage.saved>0){
      s.encourageShown=s.lastEncourage.date; save(s);
      return {saved:s.lastEncourage.saved, text:praise()};
    }
    return null;
  }

  /* 云备份（网页版用 JSON 导入导出代替云同步；小程序版将接微信云开发） */
  function exportJSON(){
    var s=getState(); return JSON.stringify({__zqg:true,v:1,data:s},null,2);
  }
  function importJSON(txt){
    try{ var o=JSON.parse(txt); if(o&&o.__zqg&&o.data){ save(o.data); return true; } }catch(e){}
    return false;
  }
  function resetAll(){ localStorage.removeItem(KEY); return defaultState(); }

  global.Store={
    getState:getState,save:save,rollover:rollover,
    setDailyBudget:setDailyBudget,todayBudget:todayBudget,todayUsed:todayUsed,todayLeft:todayLeft,todayStrictUsed:todayStrictUsed,isStrict:isStrict,
    tryExpense:tryExpense,payPenalty:payPenalty,addIncome:addIncome,deleteRecord:deleteRecord,
    createGoal:createGoal,contributeGoal:contributeGoal,markPlanDone:markPlanDone,deleteGoal:deleteGoal,
    createWish:createWish,deleteWish:deleteWish,checkUnlocks:checkUnlocks,
    checkin:checkin,updateSettings:updateSettings,setStrictLimit:setStrictLimit,
    stats:stats,praise:praise,consumeEncourage:consumeEncourage,
    exportJSON:exportJSON,importJSON:importJSON,resetAll:resetAll,
    yuan:yuan,today:today,yesterday:yesterday
  };
})(window);
