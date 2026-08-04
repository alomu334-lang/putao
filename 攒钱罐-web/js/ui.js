/* 攒钱罐·网页版 UI 逻辑 */
(function () {
  var S = window.Store;
  var screen = document.getElementById('screen');
  var modalRoot = document.getElementById('modalRoot');
  var fxRoot = document.getElementById('fxRoot');
  var toastEl = document.getElementById('toast');
  var topTitle = document.getElementById('topTitle');
  var curTab = 'index';
  var TITLES = { index:'今日', records:'账单', goal:'目标', stats:'统计', mine:'我的' };

  function yuan(n){ return S.yuan(n); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  function toast(msg){
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toast._t); toast._t=setTimeout(function(){toastEl.classList.remove('show');},1600);
  }
  function openModal(html){
    modalRoot.innerHTML = '<div class="mask"><div class="dialog">'+html+'</div></div>';
    return modalRoot.querySelector('.dialog');
  }
  function closeModal(){ modalRoot.innerHTML=''; }

  /* 鼓励 / 解锁 动画 */
  function showFx(emoji,title,sub){
    var colors=['#07c160','#ff976a','#fa5151','#ffc300','#5b8def','#9b59b6'];
    var conf='';
    for(var i=0;i<40;i++){
      var c=colors[i%colors.length];
      var left=Math.random()*100, delay=Math.random()*0.6, dur=1.6+Math.random()*1.2;
      conf+='<i class="confetti" style="left:'+left+'%;background:'+c+';animation-delay:'+delay+'s;animation-duration:'+dur+'s"></i>';
    }
    fxRoot.innerHTML='<div class="fx"><div class="fx-card">'+conf+
      '<div class="fx-emoji">'+emoji+'</div><div class="fx-title">'+esc(title)+'</div>'+
      '<div class="fx-sub">'+esc(sub)+'</div>'+
      '<button class="btn btn-primary btn-block" style="margin-top:14px" id="fxClose">好耶</button></div></div>';
    var close=function(){fxRoot.innerHTML='';};
    fxRoot.querySelector('#fxClose').onclick=close;
    fxRoot.onclick=function(e){ if(e.target.classList.contains('fx')) close(); };
  }

  /* ---------------- 今日 ---------------- */
  function renderIndex(){
    var s=S.getState();
    var budget=S.todayBudget(), used=S.todayUsed(), left=S.todayLeft();
    var set = s.budgetDate===S.today();
    var percent = budget>0?Math.min(100,Math.round(used/budget*100)):0;
    var barClass = percent>=90?'danger':(percent>=70?'warn':'');
    var checkedIn = s.lastCheckin===S.today();

    var strictUsed=S.todayStrictUsed(s);
    var strictHtml='';
    if(set){
      var sPct=Math.min(100,Math.round(strictUsed/s.strictLimit*100));
      var sClass = strictUsed>s.strictLimit?'danger':(strictUsed>s.strictLimit*0.7?'warn':'');
      strictHtml='<div class="card strict">'+
        '<div class="strict-title">🔥 今日重点管控（奶茶/炸鸡/游戏）</div>'+
        '<div class="row between" style="margin-top:5px"><span class="muted">已花 '+yuan(strictUsed)+' / 限额 '+yuan(s.strictLimit)+'</span><span class="muted">'+Math.round(sPct)+'%</span></div>'+
        '<div class="bar '+sClass+'" style="margin-top:5px"><div style="width:'+sPct+'%"></div></div>'+
        (strictUsed>s.strictLimit?'<div class="danger" style="font-size:11px;margin-top:4px">已超重点限额，再买要交罚金啦！</div>':'')+
        '</div>';
    }

    var list = S.getState().records.filter(function(r){return r.date===S.today();})
      .sort(function(a,b){return b.ts-a.ts;})
      .map(function(r){
        var c=s.categories.find(function(x){return x.key===r.catKey;});
        return '<div class="rec row between" data-del="'+r.id+'">'+
          '<div class="row"><text class="rec-icon">'+(c?c.icon:'📦')+'</text>'+
          '<div><div class="bold" style="font-size:13.5px">'+(c?c.name:'其他')+(r.strict?' <span style="color:#fa5151;font-size:10px">重点</span>':'')+'</div>'+
          '<div class="muted" style="font-size:10.5px">'+(esc(r.note)||'')+'</div></div></div>'+
          '<text class="'+(r.type==='income'?'theme':'')+' money">'+(r.type==='income'?'+':'-')+yuan(r.amount)+'</text></div>';
      }).join('');

    screen.innerHTML =
      (set?
        '<div class="card hero">'+
          '<div class="hero-label">今日还可使用</div>'+
          '<div class="hero-money money">'+yuan(left)+'</div>'+
          '<div class="hero-sub"><span class="muted">今日额度 '+yuan(budget)+'</span><span class="muted">已用 '+yuan(used)+'</span></div>'+
          '<div class="bar '+barClass+'" style="margin-top:9px"><div style="width:'+percent+'%"></div></div>'+
          (barClass?'<div class="hero-tip '+(barClass==='danger'?'danger':'')+'">⚠️ 今日额度已用 '+percent+'%，注意控制</div>':'')+
          '<div class="hero-actions"><button class="btn btn-danger" id="btnExpense">记一笔</button>'+
          '<button class="btn btn-ghost" id="btnBudget">调整额度</button></div>'+
        '</div>'
      :
        '<div class="card hero"><div class="hero-label">今天还没设置可用金额</div>'+
          '<div class="hero-money money" style="color:rgba(255,255,255,.6)">--</div>'+
          '<div class="hero-sub"><span class="muted">点下方按钮，设置今天的可用金额</span></div>'+
          '<div class="hero-actions"><button class="btn btn-ghost" id="btnBudget" style="background:#fff;color:#07c160">加额度</button></div></div>'
      )+
      strictHtml+
      '<div class="card row between"><div><div class="bold">自律打卡</div>'+
        '<div class="muted" style="margin-top:2px">已连续坚持 <span class="streak-num">'+s.streak+'</span> 天</div></div>'+
        '<button class="btn '+(checkedIn?'':'btn-primary')+'" style="width:90px;height:34px" '+(checkedIn?'disabled':'')+' id="btnCheckin">'+(checkedIn?'已打卡':'打卡')+'</button></div>'+
      '<div class="card piggy" id="btnGoal"><div class="piggy-icon">🐷</div><div style="flex:1"><div class="muted">存钱罐累计</div>'+
        '<div class="money" style="font-size:19px;margin-top:2px">'+yuan(s.savings)+'</div></div><div class="muted">我的目标 ›</div></div>'+
      '<div class="card"><div class="row between" style="margin-bottom:7px"><div class="bold">今日明细</div>'+
        '<div class="muted" id="btnRecords">全部账单 ›</div></div>'+
        (list?'<div>'+list+'</div>':'<div class="empty">今天还没有任何记录</div>')+
        (set?'<button class="btn btn-ghost btn-block" id="btnSummary" style="margin-top:10px">📝 今日小结</button>':'')+
      '</div>';

    bindIndex();
  }

  function bindIndex(){
    var b=function(id,fn){var e=document.getElementById(id);if(e)e.onclick=fn;};
    b('btnExpense',openExpense); b('btnBudget',openBudget);
    b('btnCheckin',function(){S.checkin();renderIndex();toast('打卡成功 🔥');});
    b('btnGoal',function(){switchTab('goal');});
    b('btnRecords',function(){switchTab('records');});
    b('btnSummary',function(){
      var left=S.todayLeft();
      if(left>0) showFx('🌟','今天省下了 '+yuan(left), S.praise()+' 这笔钱已经进了存钱罐 🐷');
      else toast('今天额度刚好用完，也不错');
    });
    var dels=screen.querySelectorAll('[data-del]');
    dels.forEach(function(e){ e.onclick=function(){
      if(confirm('删除这条记录？')){ S.deleteRecord(e.getAttribute('data-del')); renderIndex(); toast('已删除'); }
    };});
  }

  /* ---------------- 账单 ---------------- */
  function renderRecords(){
    var s=S.getState();
    var recs=s.records.slice().sort(function(a,b){return b.ts-a.ts;});
    var map={};
    recs.forEach(function(r){ (map[r.date]=map[r.date]||[]).push(r); });
    var groups=Object.keys(map).sort(function(a,b){return b.localeCompare(a);}).map(function(date){
      var sum=map[date].filter(function(r){return r.type==='expense';}).reduce(function(a,r){return a+r.amount;},0);
      return {date:date,sum:sum,items:map[date]};
    });
    var total=recs.filter(function(r){return r.type==='expense';}).reduce(function(a,r){return a+r.amount;},0);
    var html='<div class="card center" style="background:#fff7f0"><div class="muted">累计支出</div>'+
      '<div class="money" style="font-size:23px;color:#ff976a">'+yuan(total)+'</div></div>';
    if(!groups.length) html+='<div class="empty">暂无记录</div>';
    groups.forEach(function(g){
      var items=g.items.map(function(r){
        var c=s.categories.find(function(x){return x.key===r.catKey;});
        return '<div class="rec row between" data-del="'+r.id+'"><div class="row"><text class="rec-icon">'+(c?c.icon:'📦')+'</text>'+
          '<div><div class="bold" style="font-size:13.5px">'+(c?c.name:'其他')+'</div>'+
          '<div class="muted" style="font-size:10.5px">'+(esc(r.note)||'')+'</div></div></div>'+
          '<text class="'+(r.type==='income'?'theme':'text-2')+' money">'+(r.type==='income'?'+':'-')+yuan(r.amount)+'</text></div>';
      }).join('');
      html+='<div class="card"><div class="row between" style="margin-bottom:5px"><span class="bold">'+g.date+'</span><span class="muted">支出 '+yuan(g.sum)+'</span></div>'+items+'</div>';
    });
    screen.innerHTML=html;
    screen.querySelectorAll('[data-del]').forEach(function(e){ e.onclick=function(){
      if(confirm('删除这条记录？')){ S.deleteRecord(e.getAttribute('data-del')); renderRecords(); toast('已删除'); }
    };});
  }

  /* ---------------- 目标 + 愿望 ---------------- */
  function renderGoal(){
    var s=S.getState();
    var goals=s.goals.map(function(g){
      var planView=(g.plan||[]).map(function(amt,idx){return {idx:idx,amount:amt,done:(g.done||[]).indexOf(idx)>=0};});
      return {g:g,planView:planView};
    });
    var goalsHtml = goals.map(function(o){
      var g=o.g;
      var pct=g.target>0?Math.min(100,Math.round(g.saved/g.target*100)):0;
      var planHtml = o.planView.length?('<div style="margin-top:4px"><div class="muted" style="font-size:11px;margin:6px 0 4px">已存 '+(g.done||[]).length+'/'+(g.plan||[]).length+' 期</div>'+
        '<div class="plan-grid">'+o.planView.map(function(p){return '<div class="plan-cell '+(p.done?'done':'')+'" data-goal="'+g.id+'" data-idx="'+p.idx+'" data-done="'+p.done+'">'+p.amount+'</div>';}).join('')+'</div></div>'):'';
      return '<div class="card"><div class="row between"><div class="bold" style="font-size:15.5px">'+esc(g.name)+'</div>'+
        '<span class="muted" data-delgoal="'+g.id+'">删除</span></div>'+
        '<div class="row between" style="margin:7px 0"><span class="money" style="font-size:21px">'+yuan(g.saved)+'</span><span class="muted">目标 '+yuan(g.target)+'</span></div>'+
        '<div class="bar"><div style="width:'+pct+'%"></div></div>'+
        '<div class="row between muted" style="margin-top:4px;font-size:11px"><span>已完成 '+pct+'%</span><span>期限 '+(g.deadline||'无期限')+'</span></div>'+
        planHtml+
        '<button class="btn btn-ghost btn-block" style="margin-top:10px" data-contrib="'+g.id+'">存一笔进去</button></div>';
    }).join('');

    var wishesHtml = s.wishes.map(function(w){
      var pct=w.cost>0?Math.min(100,Math.round(s.savings/w.cost*100)):100;
      var have=s.savings>=w.cost;
      return '<div class="card wish '+(w.unlocked?'':'locked')+'">'+
        '<div class="wish-icon">'+(w.unlocked?'🎉':w.icon)+'</div>'+
        '<div style="flex:1"><div class="bold">'+esc(w.name)+'</div>'+
        '<div class="muted" style="font-size:11px">'+(w.unlocked?'已达成，奖励解锁！':('还差 '+yuan(Math.max(0,w.cost-s.savings))))+'</div>'+
        '<div class="bar" style="margin-top:4px"><div style="width:'+pct+'%"></div></div></div>'+
        '<span class="muted" data-delwish="'+w.id+'">✕</span></div>';
    }).join('');

    screen.innerHTML =
      (goals.length?'':'<div class="card center"><div style="font-size:36px">🎯</div><div class="bold" style="margin:8px 0 4px">还没有存钱目标</div><div class="muted" style="margin-bottom:10px">用 52 周 / 365 天法，攒下第一桶金</div><button class="btn btn-primary" style="width:140px" id="btnAddGoal">新建目标</button></div>')+
      goalsHtml+
      '<div class="card"><div class="row between"><div class="bold">🎁 愿望清单</div>'+
        '<span class="muted" id="btnAddWish">+ 加愿望</span></div>'+
        (wishesHtml||'<div class="empty">添加想买的东西，存够自动解锁 🔓</div>')+'</div>'+
      (goals.length?'<button class="btn btn-primary btn-block" id="btnAddGoal">+ 新建目标</button>':'');

    bindGoal();
  }

  function bindAll(sel, fn){ document.querySelectorAll(sel).forEach(function(e){ e.onclick=function(){ fn(e); }; }); }

  function bindGoal(){
    var b=function(id,fn){var e=document.getElementById(id);if(e)e.onclick=fn;};
    b('btnAddGoal',openGoalAdd); b('btnAddWish',openWishAdd);
    bindAll('[data-contrib]', function(e){
      var id=e.getAttribute('data-contrib'); var v=prompt('存入存钱罐金额：');
      if(v!=null){ var a=Number(v); if(a>0){ S.contributeGoal(id,a); renderGoal(); toast('已存入'); checkUnlockFx(); } }
    });
    bindAll('[data-delgoal]', function(e){ if(confirm('删除该目标？')){ S.deleteGoal(e.getAttribute('data-delgoal')); renderGoal(); } });
    bindAll('[data-delwish]', function(e){ if(confirm('删除该愿望？')){ S.deleteWish(e.getAttribute('data-delwish')); renderGoal(); } });
    bindAll('.plan-cell', function(e){
      S.markPlanDone(e.getAttribute('data-goal'), Number(e.getAttribute('data-idx')), e.getAttribute('data-done')!=='true');
      renderGoal(); checkUnlockFx();
    });
  }

  function checkUnlockFx(){
    var newly=S.checkUnlocks();
    if(newly.length){ var w=newly[0]; showFx('🎉','愿望解锁：'+w.name,'存钱罐已攒够 '+yuan(w.cost)+'，奖励到手！继续冲 🚀'); }
  }

  /* ---------------- 统计 ---------------- */
  function renderStats(){
    var st=S.stats();
    var maxT=Math.max(1,Math.max.apply(null,st.trend.map(function(t){return t.amount;})));
    var catHtml = st.catList.length? st.catList.map(function(c){
      var pct=st.monthTotal>0?Math.round(c.amount/st.monthTotal*100):0;
      return '<div style="margin-bottom:9px"><div class="row" style="margin-bottom:3px"><span style="margin-right:4px">'+(c.icon||'📦')+'</span>'+
        '<span class="text-2" style="flex:1">'+esc(c.name)+'</span><span class="bold">'+yuan(c.amount)+' · '+pct+'%</span></div>'+
        '<div class="bar"><div style="width:'+pct+'%"></div></div></div>';
    }).join('') : '<div class="empty">本月暂无支出</div>';
    var trendHtml=st.trend.map(function(t){return '<div class="trend-col"><span class="trend-val">'+(t.amount>0?t.amount:'')+'</span>'+
      '<div class="trend-bar-wrap"><div class="trend-bar" style="height:'+Math.round(t.amount/maxT*100)+'%"></div></div>'+
      '<span class="muted trend-date">'+t.date+'</span></div>';}).join('');

    screen.innerHTML=
      '<div class="cards3"><div class="mini card"><span class="muted">本月支出</span><span class="money mini-money">'+yuan(st.monthTotal)+'</span></div>'+
      '<div class="mini card"><span class="muted">存钱罐</span><span class="money mini-money theme">'+yuan(st.savings)+'</span></div>'+
      '<div class="mini card"><span class="muted">累计罚金</span><span class="money mini-money danger">'+yuan(st.penaltyPool)+'</span></div></div>'+
      '<div class="card"><div class="bold" style="margin-bottom:9px">本月分类占比</div>'+catHtml+'</div>'+
      '<div class="card"><div class="bold" style="margin-bottom:10px">近 7 天支出趋势</div><div class="trend">'+trendHtml+'</div></div>'+
      '<div class="card center"><span class="muted">累计总支出</span><span class="money danger" style="font-size:21px">'+yuan(st.totalExpense)+'</span></div>';
  }

  /* ---------------- 我的 ---------------- */
  function renderMine(){
    var s=S.getState();
    screen.innerHTML=
      '<div class="card row between"><div class="piggy-icon">🐷</div><div style="flex:1"><div class="bold" style="font-size:16px">攒钱罐</div>'+
        '<div class="muted" style="margin-top:2px">管住每日钱包，越攒越多</div></div></div>'+
      '<div class="card row between" id="btnPenalty"><div><div class="muted">累计罚金 / 存钱罐</div>'+
        '<div class="money" style="font-size:17px;margin-top:2px"><span class="danger">'+yuan(s.penaltyPool)+'</span><span class="muted" style="font-size:12px"> / '+yuan(s.savings)+'</span></div></div>'+
        '<div class="muted">查看 ›</div></div>'+
      '<div class="card"><div class="bold" style="font-size:12.5px;color:#9aa0a6">核心设置</div>'+
        '<div class="row between" style="padding:9px 0;border-bottom:0.5px solid var(--line)"><div><div class="bold">超支罚金比例</div><div class="muted" style="font-size:11px">超今日额度部分按此比例罚</div></div><div class="picker" id="setRate">'+Math.round(s.penaltyRate*100)+'% ›</div></div>'+
        '<div class="row between" style="padding:9px 0;border-bottom:0.5px solid var(--line)"><div><div class="bold">重点类目每日限额</div><div class="muted" style="font-size:11px">奶茶/炸鸡/游戏 合计上限</div></div><div class="picker" id="setStrict">'+yuan(s.strictLimit)+' ›</div></div>'+
        '<div class="row between" style="padding:9px 0;border-bottom:0.5px solid var(--line)"><div><div class="bold">昨日结余结转</div><div class="muted" style="font-size:11px">没花完的钱计入明天额度</div></div><label class="switch"><input type="checkbox" id="swCarry" '+(s.carryOverEnabled?'checked':'')+'></label></div>'+
        '<div class="row between" style="padding:9px 0"><div><div class="bold">结余自动存钱</div><div class="muted" style="font-size:11px">每天没花完的余额进存钱罐</div></div><label class="switch"><input type="checkbox" id="swSave" '+(s.savingsAuto?'checked':'')+'></label></div>'+
      '</div>'+
      '<div class="card"><div class="bold" style="font-size:12.5px;color:#9aa0a6">数据与备份</div>'+
        '<div class="menu" id="btnExport">导出备份(JSON) ›</div>'+
        '<div class="menu" id="btnImport">导入备份(JSON) ›</div>'+
        '<div class="menu" id="btnCloud">云同步（微信小程序专属）›</div>'+
        '<div class="menu" id="btnAbout">关于攒钱罐 ›</div>'+
        '<div class="menu danger" id="btnReset">清空所有数据 ›</div></div>'+
      '<div class="center muted" style="font-size:10.5px;margin-top:8px">网页版 v1.0 · 本地存储</div>';

    document.getElementById('btnPenalty').onclick=openPenalty;
    document.getElementById('btnExport').onclick=function(){
      var txt=S.exportJSON();
      if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(function(){toast('备份已复制到剪贴板');},function(){download(txt);}); }
      else download(txt);
    };
    document.getElementById('btnImport').onclick=function(){
      var t=prompt('粘贴之前导出的备份内容：'); if(t!=null){ if(S.importJSON(t)){toast('导入成功');switchTab(curTab);} else toast('内容无效'); }
    };
    document.getElementById('btnCloud').onclick=function(){ toast('云同步为微信小程序专属功能（微信云开发）'); };
    document.getElementById('btnAbout').onclick=function(){ alert('攒钱罐：每天设可用金额，花超了自动拦截并罚金存钱。\n含重点类目管控(奶茶/炸鸡/游戏)、每日省钱鼓励、愿望解锁动画。\n网页版数据存在本机浏览器；小程序版将接入微信云开发多端同步与预算超支订阅消息。'); };
    document.getElementById('btnReset').onclick=function(){ if(confirm('清空全部数据且不可恢复？')){ S.resetAll(); toast('已清空'); switchTab('index'); } };
    document.getElementById('setRate').onclick=function(){
      var v=prompt('罚金比例（输入 10 / 20 / 30 / 50）：',Math.round(S.getState().penaltyRate*100));
      if(v!=null){var n=Number(v);if([10,20,30,50].indexOf(n)>=0){S.updateSettings({penaltyRate:n/100});renderMine();}}
    };
    document.getElementById('setStrict').onclick=function(){
      var v=prompt('重点类目（奶茶/炸鸡/游戏）每日总限额：',S.getState().strictLimit);
      if(v!=null){var n=Number(v);if(n>=0){S.setStrictLimit(n);renderMine();}}
    };
    document.getElementById('swCarry').onchange=function(e){S.updateSettings({carryOverEnabled:e.target.checked});};
    document.getElementById('swSave').onchange=function(e){S.updateSettings({savingsAuto:e.target.checked});};
  }

  function download(txt){
    var a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(txt);
    a.download='zqg-backup.json'; a.click(); toast('已下载备份文件');
  }

  function openPenalty(){
    var s=S.getState();
    var total=s.penalties.reduce(function(a,p){return a+p.penalty;},0);
    var list=s.penalties.slice().sort(function(a,b){return b.ts-a.ts;}).map(function(p){
      return '<div class="card rec"><div class="row between"><div><div class="bold">超支 '+yuan(p.overflow)+'</div>'+
        '<div class="muted" style="font-size:11px">'+p.date+'</div></div>'+
        '<span class="danger money">罚金 '+yuan(p.penalty)+'</span></div></div>';
    }).join('');
    openModal('<div class="dialog-title">罚金记录</div><div class="center" style="margin:5px 0 10px"><div class="muted">累计罚金（已全部进入存钱罐）</div><div class="money danger" style="font-size:26px">'+yuan(total)+'</div><div class="muted">共 '+s.penalties.length+' 次超支</div></div>'+
      (list||'<div class="empty">太棒了，还没被罚过 🎉</div>')+
      '<button class="btn btn-primary btn-block" style="margin-top:10px" id="pClose">关闭</button>');
    document.getElementById('pClose').onclick=closeModal;
  }

  /* ---------------- 加额度 ---------------- */
  function openBudget(){
    var s=S.getState();
    var d=openModal('<div class="dialog-title">设置今日可用金额</div>'+
      '<div class="amount-big">¥<span id="bdVal">'+(s.budgetDate===S.today()?s.dailyBudget:'')+'</span></div>'+
      '<div class="muted center" style="font-size:11px">当前今日总额度 '+yuan(S.todayBudget())+'</div>'+
      '<div class="presets" id="bdPresets"></div>'+
      '<button class="btn btn-primary btn-block" id="bdSave">保存今日可用金额</button>'+
      '<button class="btn btn-block" style="margin-top:7px;background:#f2f3f5;color:#555" id="bdCancel">取消</button>');
    var val=d.querySelector('#bdVal');
    function setVal(v){ val.textContent=v; }
    d.querySelector('#bdPresets').innerHTML=[50,100,200,300,500,1000].map(function(p){return '<span class="preset" data-v="'+p+'">+'+p+'</span>';}).join('');
    d.querySelectorAll('.preset').forEach(function(e){e.onclick=function(){ setVal(Number(val.textContent||0)+Number(e.getAttribute('data-v'))); };});
    d.querySelector('#bdSave').onclick=function(){
      var amt=Number(val.textContent);
      if(!amt||amt<=0){toast('请输入金额');return;}
      S.setDailyBudget(amt); closeModal(); toast('今日可用金额已设置'); switchTab('index');
    };
    d.querySelector('#bdCancel').onclick=closeModal;
  }

  /* ---------------- 记一笔（含拦截/罚金） ---------------- */
  function openExpense(){
    var s=S.getState();
    if(s.budgetDate!==S.today()){ toast('请先设置今日可用金额'); openBudget(); return; }
    var cats=s.categories;
    var sel=cats[0].key;
    var d=openModal('<div class="dialog-title">记一笔</div>'+
      '<div class="muted center" style="font-size:11.5px">记这笔后，今日还可使用 <b class="theme" id="exLeft">'+yuan(S.todayLeft())+'</b></div>'+
      '<div class="cats" id="exCats" style="margin:8px 0"></div>'+
      '<div class="row" style="border-bottom:0.5px solid var(--line);padding-bottom:8px"><span style="font-size:22px;font-weight:700">¥</span><input class="fld" style="font-size:28px;font-weight:700;margin-left:5px" id="exAmt" type="number" inputmode="decimal" placeholder="0.00"></div>'+
      '<input class="fld" style="margin-top:7px" id="exNote" placeholder="备注（可选）">'+
      '<button class="btn btn-danger btn-block" id="exOk">确认支付</button>'+
      '<button class="btn btn-block" style="margin-top:7px;background:#f2f3f5;color:#555" id="exCancel">取消</button>');
    var catBox=d.querySelector('#exCats');
    function drawCats(){
      catBox.innerHTML=cats.map(function(c){return '<div class="cat '+(sel===c.key?'on ':'')+(c.strict?'strict':'')+'" data-k="'+c.key+'"><text class="cat-icon">'+c.icon+'</text><text class="cat-name">'+c.name+'</text></div>';}).join('');
      catBox.querySelectorAll('.cat').forEach(function(e){e.onclick=function(){sel=e.getAttribute('data-k');drawCats();};});
    }
    drawCats();
    d.querySelector('#exCancel').onclick=closeModal;
    d.querySelector('#exOk').onclick=function(){
      var amt=Number(d.querySelector('#exAmt').value);
      var note=d.querySelector('#exNote').value;
      var res=S.tryExpense(sel,amt,note);
      if(res.ok){ closeModal(); toast('已记录，今日还可使用 '+yuan(res.left)); switchTab('index'); }
      else if(res.msg){ toast(res.msg); }
      else { openBlock(res); }
    };
  }

  function openBlock(res){
    var html='<div class="dialog-icon">⛔</div><div class="dialog-title">支付被拦截</div>';
    if(res.strict){
      html+='<div class="dialog-text">这笔 <b>'+yuan(res.total)+'</b> 属于<b class="danger"> 重点管控类目</b><br>今日奶茶/炸鸡/游戏已花 <b>'+yuan(res.strictUsed)+'</b><br>超过限额 <b class="danger">'+yuan(res.strictLimit)+'</b> 达 <b class="danger">'+yuan(res.overflow)+'</b></div>'+
        '<div class="dialog-penalty">认罚缴纳罚金 <b class="danger">'+yuan(res.penalty)+'</b>（进入存钱罐）</div>'+
        '<button class="btn btn-danger btn-block" id="blPay">缴纳罚金并放弃</button>'+
        '<button class="btn btn-block" style="margin-top:7px;background:#f2f3f5;color:#555" id="blBack">返回修改金额</button>';
    } else {
      html+='<div class="dialog-text">你试图支付 <b>'+yuan(res.total)+'</b><br>但今日仅剩 <b class="theme">'+yuan(res.total-res.overflow)+'</b><br>超出 <b class="danger">'+yuan(res.overflow)+'</b></div>'+
        '<div class="dialog-penalty">认罚缴纳罚金 <b class="danger">'+yuan(res.penalty)+'</b>（进入存钱罐）</div>'+
        '<button class="btn btn-danger btn-block" id="blPay">缴纳罚金并放弃支付</button>'+
        '<button class="btn btn-ghost btn-block" style="margin-top:7px" id="blLeft">只花光今日剩余</button>'+
        '<button class="btn btn-block" style="margin-top:7px;background:#f2f3f5;color:#555" id="blBack">返回修改金额</button>';
    }
    var d=openModal(html);
    d.querySelector('#blPay').onclick=function(){ S.payPenalty(res.overflow,res.penalty); closeModal(); toast('罚金 '+yuan(res.penalty)+' 已进存钱罐'); switchTab('index'); checkUnlockFx(); };
    d.querySelector('#blBack').onclick=closeModal;
    var bl=d.querySelector('#blLeft'); if(bl) bl.onclick=function(){
      var left=S.todayLeft(); var r2=S.tryExpense(sel,left,noteVal());
      closeModal(); if(r2.ok){ toast('已花光今日剩余'); switchTab('index'); } else openBlock(r2);
    };
  }
  function noteVal(){ var e=document.querySelector('#exNote'); return e?e.value:''; }

  /* ---------------- 新建目标 ---------------- */
  function openGoalAdd(){
    var d=openModal('<div class="dialog-title">新建存钱目标</div>'+
      '<input class="fld" id="gName" placeholder="目标名称（如：买电脑）">'+
      '<div class="muted" style="margin:7px 0 4px">选择方式</div>'+
      '<div id="gMethods"></div>'+
      '<div id="gExtra"></div>'+
      '<button class="btn btn-primary btn-block" style="margin-top:10px" id="gOk">创建</button>'+
      '<button class="btn btn-block" style="margin-top:7px;background:#f2f3f5;color:#555" id="gCancel">取消</button>');
    var method='52week';
    var methods=[{k:'52week',n:'52周存钱法',d:'每周递增，一年攒一笔'},{k:'365day',n:'365天存钱法',d:'每天 1~365，积少成多'},{k:'custom',n:'自定义目标',d:'自己定目标和期限'}];
    function drawM(){ d.querySelector('#gMethods').innerHTML=methods.map(function(m){return '<div class="fld-row" data-m="'+m.k+'" style="margin-top:5px"><div><div class="bold" style="font-size:13.5px">'+m.n+'</div><div class="muted" style="font-size:10.5px">'+m.d+'</div></div>'+(method===m.k?'<span class="theme">✓</span>':'')+'</div>';}).join('');
      d.querySelectorAll('[data-m]').forEach(function(e){e.onclick=function(){method=e.getAttribute('data-m');drawM();drawExtra();};}); }
    function drawExtra(){ var ex=d.querySelector('#gExtra'); var h='';
      if(method==='52week') h='<div class="fld-row" style="margin-top:6px"><span>每周基数</span><input class="fld" id="gUnit" value="10" style="width:80px;text-align:right;font-weight:600"></div>';
      if(method==='custom') h='<div class="fld-row" style="margin-top:6px"><span>目标金额</span><input class="fld" id="gTarget" placeholder="0" style="width:80px;text-align:right;font-weight:600"></div>';
      h+='<div class="fld-row" style="margin-top:6px"><span>截止日期</span><input class="fld" id="gDate" type="date" style="width:110px;text-align:right"></div>';
      ex.innerHTML=h; }
    drawM(); drawExtra();
    d.querySelector('#gCancel').onclick=closeModal;
    d.querySelector('#gOk').onclick=function(){
      var opt={name:d.querySelector('#gName').value,method:method,unit:Number(d.querySelector('#gUnit')?d.querySelector('#gUnit').value:10)||10,deadline:d.querySelector('#gDate')?d.querySelector('#gDate').value:''};
      if(method==='custom') opt.target=Number(d.querySelector('#gTarget')?d.querySelector('#gTarget').value:0)||0;
      S.createGoal(opt); closeModal(); toast('目标已创建'); switchTab('goal');
    };
  }

  /* ---------------- 加愿望 ---------------- */
  function openWishAdd(){
    var d=openModal('<div class="dialog-title">🎁 添加愿望</div>'+
      '<input class="fld" id="wName" placeholder="想要什么？（如：Switch）">'+
      '<div class="fld-row" style="margin-top:6px"><span>预计花费</span><input class="fld" id="wCost" type="number" placeholder="0" style="width:90px;text-align:right;font-weight:600"></div>'+
      '<div class="fld-row" style="margin-top:6px"><span>图标</span><input class="fld" id="wIcon" value="🎁" style="width:60px;text-align:center;font-size:18px"></div>'+
      '<button class="btn btn-primary btn-block" style="margin-top:10px" id="wOk">添加</button>'+
      '<button class="btn btn-block" style="margin-top:7px;background:#f2f3f5;color:#555" id="wCancel">取消</button>');
    d.querySelector('#wCancel').onclick=closeModal;
    d.querySelector('#wOk').onclick=function(){
      var name=d.querySelector('#wName').value, cost=Number(d.querySelector('#wCost').value), icon=d.querySelector('#wIcon').value||'🎁';
      if(!name){toast('请输入愿望名');return;}
      var r=S.createWish(name,cost,icon); closeModal();
      if(r.unlocked.length||r.wish.cost>0&&S.getState().savings>=r.wish.cost){ showFx('🎉','愿望解锁：'+name,'存钱罐已攒够 '+yuan(r.wish.cost)+'，奖励到手！'); }
      else toast('愿望已添加');
      switchTab('goal');
    };
  }

  /* ---------------- 路由 ---------------- */
  function switchTab(tab){
    curTab=tab; topTitle.textContent=TITLES[tab]||'';
    document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('on',t.getAttribute('data-tab')===tab); });
    if(tab==='index') renderIndex();
    else if(tab==='records') renderRecords();
    else if(tab==='goal') renderGoal();
    else if(tab==='stats') renderStats();
    else if(tab==='mine') renderMine();
  }

  /* ---------------- 初始化 ---------------- */
  function init(){
    S.rollover();
    document.querySelectorAll('.tab').forEach(function(t){ t.onclick=function(){ switchTab(t.getAttribute('data-tab')); }; });
    switchTab('index');
    var enc=S.consumeEncourage();
    if(enc){ setTimeout(function(){ showFx('🌟','昨天你省下了 '+yuan(enc.saved), enc.text+' 这笔钱已经进了存钱罐 🐷'); },400); }
  }

  if(document.readyState!=='loading') init();
  else document.addEventListener('DOMContentLoaded',init);
})();
