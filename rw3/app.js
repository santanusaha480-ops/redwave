const SUPABASE_URL=window.SUPABASE_URL, SUPABASE_KEY=window.SUPABASE_PUBLISHABLE_KEY;
const supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
const SITE_URL=(location.protocol==='http:'||location.protocol==='https:') ? (location.origin + '/') : '';
const AUTH_REDIRECT=SITE_URL;
function authError(error){ if(!error) return ''; const m=(error.message||String(error)); if(/email.*not confirmed/i.test(m)) return 'Your email is not confirmed yet. Check your inbox for the RedWave confirmation email.'; if(/invalid login credentials/i.test(m)) return 'Incorrect email or password.'; if(/rate limit/i.test(m)) return 'Too many attempts. Please wait a little and try again.'; return m; }
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s); let songs=[],liked=new Set(),current=null,currentIndex=-1,signup=false,currentLyrics=[];
let songsLoaded=false,likesLoaded=false,searchTimer=null,lastLyricsIndex=-1,lastLyricsRender=0;
function parseLyrics(raw){if(!raw)return []; try{const x=typeof raw==='string'?JSON.parse(raw):raw;if(Array.isArray(x))return x.map(v=>({time:Number(v.time)||0,text:String(v.text||'')})).filter(v=>v.text); }catch(_){} return String(raw).split(/\n+/).map((text,i)=>({time:i*5,text:text.trim()})).filter(v=>v.text);}
function renderLyrics(t){const box=$('#lyrics');if(!box)return;const lines=currentLyrics;if(!lines.length||box.classList.contains('hide'))return;let idx=lastLyricsIndex<0?0:lastLyricsIndex;for(let i=Math.max(0,lastLyricsIndex);i<lines.length;i++){if(t>=Math.max(0,lines[i].time-2))idx=i;else break}if(idx===lastLyricsIndex&&performance.now()-lastLyricsRender<300)return;lastLyricsIndex=idx;lastLyricsRender=performance.now();$('#lyricPrev').textContent=lines[idx-1]?.text||'';$('#lyricCurrent').textContent=lines[idx]?.text||'';$('#lyricNext').textContent=lines[idx+1]?.text||'';const active=$('#lyricCurrent');if(active)active.scrollIntoView({behavior:'auto',block:'center'});}
function seekBy(sec){const a=$('#audio');if(!a.src)return;a.currentTime=Math.max(0,Math.min((a.duration||Infinity),a.currentTime+sec));renderLyrics(a.currentTime);}
// --- RedWave audio player ---
function updatePlayerUI(song){
  if(!song) return;
  const pc=$('#pc'), pt=$('#pt'), pa=$('#pa'), lc=$('#likecur');
  if(pc){pc.src=cover(song); pc.onerror=()=>{pc.src=fallback;};}
  if(pt)pt.textContent=song.title||'Unknown title';
  if(pa)pa.textContent=song.artist||'Unknown artist';
  if(lc)lc.textContent=liked.has(song.id)?'♥':'♡';
  const lt=$('#lyricsTitle'), la=$('#lyricsArtist');
  if(lt)lt.textContent=`Lyrics — ${song.title||'Song'}`;
  if(la)la.textContent=song.artist||'';
}
async function playSong(id){
  try{
    if(!songs.length) await loadSongs(true);
    const song=songs.find(x=>String(x.id)===String(id));
    if(!song){showMsg('Song could not be found.','info');return;}
    if(!song.audio_url){
      showMsg('This song has no audio file attached. Please edit it in the Admin Panel and upload the audio file.','info');
      return;
    }
    const a=$('#audio');
    if(!a){showMsg('Audio player is unavailable. Please refresh the page.','info');return;}
    current=song;
    currentIndex=songs.findIndex(x=>String(x.id)===String(song.id));
    currentLyrics=parseLyrics(song.lyrics);
    lastLyricsIndex=-1;
    lastLyricsRender=0;
    updatePlayerUI(song);
    a.pause();
    a.removeAttribute('src');
    a.load();
    a.src=song.audio_url;
    a.volume=Number($('#volume')?.value ?? 0.8);
    a.load();
    $('#prog').value=0;
    $('#el').textContent='0:00';
    $('#du').textContent=fmt(song.duration||0);
    const playPromise=a.play();
    if(playPromise) await playPromise;
    $('#play').textContent='❚❚';
  }catch(err){
    console.error('RedWave playback error:',err);
    $('#play').textContent='▶';
    const msg=(err&&err.message)||String(err);
    showMsg(/not supported|decode|media/i.test(msg)
      ? 'This audio file could not be played. Check that the uploaded file is a valid MP3/M4A file and that its Supabase Storage URL is public.'
      : `Could not play this song: ${msg}`,'info');
  }
}
function next(){
  if(!songs.length)return;
  const idx=currentIndex<0?0:(currentIndex+1)%songs.length;
  playSong(songs[idx].id);
}
function prev(){
  if(!songs.length)return;
  const idx=currentIndex<=0?songs.length-1:currentIndex-1;
  playSong(songs[idx].id);
}
async function like(songId){
  try{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){showMsg('Please log in to like songs.','info');return;}
    const isLiked=liked.has(songId);
    if(isLiked){
      const {error}=await supabase.from('likes').delete().eq('song_id',songId).eq('user_id',user.id);
      if(error)throw error;
      liked.delete(songId);
    }else{
      const {error}=await supabase.from('likes').insert({song_id:songId,user_id:user.id});
      if(error)throw error;
      liked.add(songId);
    }
    if(current&&String(current.id)===String(songId))$('#likecur').textContent=liked.has(songId)?'♥':'♡';
    await loadLikes(true);
  }catch(err){
    console.error('Like error:',err);
    showMsg(err.message||'Could not update like.','info');
  }
}

const fallback='assets/default.svg';
function esc(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fmt(sec){sec=Math.max(0,Number(sec)||0);return `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`}
async function profile(){const {data:{user}}=await supabase.auth.getUser();if(!user)return null;const {data}=await supabase.from('profiles').select('id,name,avatar_url,role').eq('id',user.id).maybeSingle();return data}
let currentProfile=null;
async function upload(bucket,file,folder){if(!file)return null;const ext=(file.name.split('.').pop()||'bin').toLowerCase();const path=`${folder}/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type||undefined,cacheControl:'31536000',upsert:false});if(error)throw error;return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl}
async function refreshUserBadge(){const p=await profile();currentProfile=p;$('#userAvatar').src=p?.avatar_url||fallback;$('#userName').textContent=p?.name||'Listener';const adminLink=$('#adminLink');if(adminLink)adminLink.classList.toggle('hide',p?.role!=='admin');return p}
async function loadSongs(force=false){if(songsLoaded&&!force)return songs;const {data,error}=await supabase.from('songs').select('*').order('created_at',{ascending:false});if(error){console.error(error);return songs}songs=data||[];songsLoaded=true;return songs}
async function loadLikes(force=false){if(likesLoaded&&!force)return;const {data,error}=await supabase.from('likes').select('song_id');if(!error){liked=new Set((data||[]).map(x=>x.song_id));likesLoaded=true}}
function cover(s){return s.cover_url||fallback}
function card(s){return `<div class="card" onclick="playSong(${s.id})"><img class="cover" loading="lazy" src="${esc(cover(s))}" onerror="this.src='${fallback}'"><b>${esc(s.title)}</b><small>${esc(s.artist)}</small></div>`}
function row(s){return `<div class="row" onclick="playSong(${s.id})"><img loading="lazy" src="${esc(cover(s))}" onerror="this.src='${fallback}'"><div><b>${esc(s.title)}</b><small>${esc(s.artist)} • ${esc(s.album||'Single')}</small></div><span>${esc(s.genre||'')}</span><div class="row-actions"><button onclick="event.stopPropagation();like(${s.id})">${liked.has(s.id)?'♥':'♡'}</button><button onclick="event.stopPropagation();playSong(${s.id})">▶</button></div></div>`}
function playlistRow(s,playlistId){return `<div class="row" onclick="playSong(${s.id})"><img loading="lazy" src="${esc(cover(s))}" onerror="this.src='${fallback}'"><div><b>${esc(s.title)}</b><small>${esc(s.artist)} • ${esc(s.album||'Single')}</small></div><span>${esc(s.genre||'')}</span><div class="row-actions"><button onclick="event.stopPropagation();like(${s.id})">${liked.has(s.id)?'♥':'♡'}</button><button onclick="event.stopPropagation();playSong(${s.id})">▶</button><button class="remove-playlist-song" title="Remove from playlist" aria-label="Remove ${esc(s.title)} from playlist" onclick="event.stopPropagation();removeSongFromPlaylist('${esc(playlistId)}','${esc(s.id)}')">✕</button></div></div>`} 
async function deletePlaylist(playlistId){
  const lists=await getPlaylists(), p=lists.find(x=>x.id===playlistId); if(!p)return;
  if(!confirm(`Delete playlist "${p.name}"? This will remove the playlist and all songs from it. Your original songs will not be deleted.`))return;
  await savePlaylists(lists.filter(x=>x.id!==playlistId));
  await renderPlaylistSidebar();
  await library();
  showMsg(`Playlist "${p.name}" deleted.`,'info');
}
async function removeSongFromPlaylist(playlistId,songId){
  const lists=await getPlaylists(), p=lists.find(x=>x.id===playlistId);
  if(!p)return;
  p.songs=(p.songs||[]).filter(id=>String(id)!==String(songId));
  await savePlaylists(lists);
  await renderPlaylistSidebar();
  await showPlaylist(playlistId);
  showMsg(`Removed from ${p.name}`,'info');
}

async function home(){const main=document.querySelector('main');if(main)main.scrollTop=0;songs=await loadSongs();await loadLikes();const p=await refreshUserBadge();const first=songs[0];$('#content').innerHTML=`<div class="hero"><h1>Good evening, ${esc((p?.name||'Listener').split(' ')[0])}.</h1><p>Discover music, build playlists and enjoy your favorite tracks.</p><button class="primary" onclick="${first?`playSong(${first.id})`:''}">▶ Start listening</button></div><div class="section"><div class="section-head"><h2>Made for you</h2></div><div class="cards">${songs.slice(0,8).map(card).join('')||'<div class="empty">No music has been published yet.</div>'}</div></div><div class="section"><div class="section-head"><h2>Recently added</h2></div>${songs.map(row).join('')||'<div class="empty">Your music catalogue is empty.</div>'}</div>`}
async function search(){const main=document.querySelector('main');if(main)main.scrollTop=0;songs=await loadSongs();await loadLikes();const q=$('#search').value.trim().toLowerCase(),a=songs.filter(s=>(`${s.title} ${s.artist} ${s.album||''} ${s.genre||''}`).toLowerCase().includes(q));$('#content').innerHTML=`<div class="section"><h2>Search</h2><p class="muted">${q?'Results for “'+esc(q)+'”':'Search songs, artists, albums or genres.'}</p>${a.map(row).join('')||'<div class="empty">Nothing found.</div>'}</div>`}
function playlistKey(){return 'redwave_playlists_'+(supabase.auth.getSession ? 'user' : 'guest')}
async function getPlaylistStore(){
  const {data:{user}}=await supabase.auth.getUser();
  return 'redwave_playlists_'+(user?.id||'guest');
}
async function getPlaylists(){
  try{return JSON.parse(localStorage.getItem(await getPlaylistStore())||'[]')}catch(e){return []}
}
async function savePlaylists(list){localStorage.setItem(await getPlaylistStore(),JSON.stringify(list))}
let editingPlaylistId=null, playlistCoverData=null;
function resetPlaylistCover(){playlistCoverData=null;$('#playlistCoverPreview').src=fallback;$('#playlistCoverFile').value='';}
function openPlaylistModal(playlistId=null){
  editingPlaylistId=playlistId;
  const modal=$('#playlistModal'), title=$('#playlistModalTitle'), sub=$('#playlistModalSub'), submit=$('#playlistSubmit');
  modal.classList.remove('hide'); $('#playlistMsg').textContent=''; resetPlaylistCover();
  if(playlistId){
    getPlaylists().then(lists=>{const p=lists.find(x=>x.id===playlistId);if(!p)return;title.textContent='Edit Playlist';sub.textContent='Change your playlist name or cover.';submit.textContent='Save Changes';$('#playlistName').value=p.name||'';$('#playlistCoverPreview').src=p.cover||fallback;playlistCoverData=p.cover||null;setTimeout(()=>$('#playlistName').focus(),50);});
  }else{
    // Explicitly clear edit state for every new-playlist flow.
    editingPlaylistId=null;
    title.textContent='Create Playlist';sub.textContent='Give your new playlist a name and cover.';submit.textContent='Create Playlist';$('#playlistName').value='';setTimeout(()=>$('#playlistName').focus(),50);
  }
}
function closePlaylistModal(){editingPlaylistId=null;$('#playlistModal').classList.add('hide');}
function readPlaylistCover(file){
  return new Promise((resolve,reject)=>{
    if(!file)return resolve(null);
    if(!file.type.startsWith('image/'))return reject(Error('Please choose an image file.'));
    if(file.size>10*1024*1024)return reject(Error('Please choose an image smaller than 10 MB.'));
    const img=new Image(), reader=new FileReader();
    reader.onload=()=>{
      img.onload=()=>{
        const max=420, scale=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(img.width*scale)); c.height=Math.max(1,Math.round(img.height*scale));
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL('image/jpeg',.68));
      };
      img.onerror=()=>reject(Error('Could not read that image.'));
      img.src=reader.result;
    };
    reader.onerror=()=>reject(Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}
async function createOrUpdatePlaylist(name){
  name=String(name||'').trim();
  if(!name) throw Error('Please enter a playlist name.');
  if(name.length>60) throw Error('Playlist name must be 60 characters or less.');

  // Keep playlist creation independent from the rest of the page rendering.
  // This prevents a library/sidebar refresh error from making a successful
  // playlist creation look like it failed.
  const key=await getPlaylistStore();
  let lists=[];
  try {
    const raw=localStorage.getItem(key);
    lists=raw ? JSON.parse(raw) : [];
    if(!Array.isArray(lists)) lists=[];
  } catch(e) {
    throw Error('RedWave could not access browser storage. Please allow site storage and try again.');
  }

  // Only enter edit mode when the modal explicitly opened an existing playlist.
  // If a stale/missing edit id is present, safely fall back to creating a new playlist.
  const editId = editingPlaylistId == null ? null : String(editingPlaylistId);
  const p = editId ? lists.find(x => String(x.id) === editId) : null;
  if(editId && p){
    p.name=name;
    if(playlistCoverData) p.cover=playlistCoverData;
    try {
      localStorage.setItem(key,JSON.stringify(lists));
    } catch(e) {
      throw Error('The playlist could not be saved. Try a smaller cover image.');
    }
    const id=p.id;
    closePlaylistModal();
    showMsg('Playlist updated successfully.','info');
    // Refresh UI without turning a refresh error into a save error.
    try { await renderPlaylistSidebar(); } catch(e) { console.warn('Sidebar refresh:',e); }
    try { await library(); } catch(e) { console.warn('Library refresh:',e); }
    try { await showPlaylist(id); } catch(e) { console.warn('Playlist view:',e); }
  }else{
    const p={
      id:(crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString()+Math.random().toString(36).slice(2)),
      name,
      songs:[],
      cover:playlistCoverData||null,
      created_at:new Date().toISOString()
    };
    lists.push(p);
    try {
      localStorage.setItem(key,JSON.stringify(lists));
      // Verify immediately so we never report success when nothing was stored.
      const saved=JSON.parse(localStorage.getItem(key)||'[]');
      if(!saved.some(x=>String(x.id)===String(p.id))) throw new Error('verification failed');
    } catch(e) {
      throw Error('The playlist could not be saved. Try a smaller cover image or allow site storage.');
    }
    closePlaylistModal();
    showMsg('Playlist created successfully.','info');
    try { await renderPlaylistSidebar(); } catch(e) { console.warn('Sidebar refresh:',e); }
    try { await library(); } catch(e) { console.warn('Library refresh:',e); }
  }
}
async function renderPlaylistSidebar(){
  const lists=await getPlaylists();
  $('#pls').innerHTML=lists.map(p=>`<button class="side playlist-link" data-pid="${esc(p.id)}">${p.cover?`<img class="playlist-side-cover" src="${esc(p.cover)}" onerror="this.src='${fallback}'">`:'♫'} <span>${esc(p.name)}</span></button>`).join('');
  $$('.playlist-link').forEach(b=>b.onclick=()=>showPlaylist(b.dataset.pid));
}
async function showPlaylist(id){
  const lists=await getPlaylists(), p=lists.find(x=>x.id===id); if(!p)return;
  const ids=new Set(p.songs||[]), ps=songs.filter(s=>ids.has(String(s.id))||ids.has(s.id));
  const coverHtml=p.cover?`<img class="playlist-hero-cover" src="${esc(p.cover)}" onerror="this.src='${fallback}'">`:`<div class="playlist-hero-cover placeholder">♫</div>`;
  $('#content').innerHTML=`<div class="playlist-detail"><div class="playlist-hero">${coverHtml}<div class="playlist-hero-info"><span class="eyebrow">PLAYLIST</span><h1>${esc(p.name)}</h1><p class="muted">${ps.length} song${ps.length===1?'':'s'}</p><div class="playlist-actions"><button class="primary small" id="addToPlaylistFromView">＋ Add songs</button><button class="secondary small" id="editPlaylistFromView">✎ Edit playlist</button><button class="danger small" id="deletePlaylistFromView">🗑 Delete playlist</button></div></div></div><div class="section playlist-songs-section">${ps.map(s=>playlistRow(s,id)).join('')||'<div class="empty">This playlist is empty. Click “Add songs” to choose music.</div>'}</div></div>`;
  $('#addToPlaylistFromView').onclick=()=>openSongPicker(id); $('#editPlaylistFromView').onclick=()=>openPlaylistModal(id); $('#deletePlaylistFromView').onclick=()=>deletePlaylist(id);
}
async function openSongPicker(playlistId, songId=null){
  const lists=await getPlaylists(), p=lists.find(x=>x.id===playlistId);
  if(!p)return;
  songs=await loadSongs();
  const existing=new Set((p.songs||[]).map(String));
  const available=songs.filter(s=>!existing.has(String(s.id)));
  $('#songPickerTitle').textContent=`Add songs to ${p.name}`;
  $('#songPickerSub').textContent=available.length?`${available.length} song${available.length===1?'':'s'} available`:'All available songs are already in this playlist.';
  $('#songPickerList').innerHTML=available.map(s=>`<button class="song-picker-item" data-song-id="${esc(s.id)}"><img src="${esc(cover(s))}" onerror="this.src='${fallback}'"><span><b>${esc(s.title)}</b><small>${esc(s.artist)}</small></span><strong>＋</strong></button>`).join('') || '<div class="empty">No more songs to add.</div>';
  $('#songPickerModal').classList.remove('hide');
  $$('.song-picker-item').forEach(b=>b.onclick=async()=>{await addSongToPlaylist(playlistId,b.dataset.songId);});
}
async function addSongToPlaylist(playlistId,songId){
  const lists=await getPlaylists(), p=lists.find(x=>x.id===playlistId);
  if(!p)return;
  p.songs=p.songs||[];
  const sid=String(songId);
  if(!p.songs.map(String).includes(sid))p.songs.push(songId);
  await savePlaylists(lists);
  $('#songPickerModal').classList.add('hide');
  await renderPlaylistSidebar();
  await showPlaylist(playlistId);
  showMsg(`Added to ${p.name}`,'info');
}
async function addCurrentSongToPlaylist(){
  if(!current){showMsg('Play a song first.','info');return;}
  const lists=await getPlaylists();
  if(!lists.length){openPlaylistModal();return;}
  openPlaylistChooserForCurrent();
}
function openPlaylistChooserForCurrent(){
  const listsPromise=getPlaylists();
  listsPromise.then(lists=>{
    $('#songPickerTitle').textContent=`Add “${current.title}” to playlist`;
    $('#songPickerSub').textContent='Choose the playlist you want to add the currently playing song to.';
    $('#songPickerList').innerHTML=lists.map(p=>{
      const has=(p.songs||[]).map(String).includes(String(current.id));
      return `<button class="song-picker-item ${has?'already-added':''}" data-pid="${esc(p.id)}" ${has?'disabled':''}><span><b>♫ ${esc(p.name)}</b><small>${has?'Already added':'Add this song'}</small></span><strong>${has?'✓':'＋'}</strong></button>`;
    }).join('');
    $('#songPickerModal').classList.remove('hide');
    $$('.song-picker-item').forEach(b=>b.onclick=async()=>{if(!b.disabled){await addSongToPlaylist(b.dataset.pid,current.id);}});
  });
}
async function library(){
  songs=await loadSongs(); await loadLikes(); const a=songs.filter(s=>liked.has(s.id)), lists=await getPlaylists();
  $('#content').innerHTML=`<div class="section"><div class="section-head"><div><h2>Your Library</h2><p class="muted">Your liked songs and playlists.</p></div><button class="primary small" id="createPlaylistBtn">＋ Create Playlist</button></div><div class="playlist-grid">${lists.map(p=>`<button class="playlist-tile" data-pid="${esc(p.id)}">${p.cover?`<img src="${esc(p.cover)}" onerror="this.src='${fallback}'">`:'<span>♫</span>'}<b>${esc(p.name)}</b><small>${(p.songs||[]).length} songs</small></button>`).join('')||'<div class="empty playlist-empty">Create your first playlist.</div>'}</div><div class="section"><div class="section-head"><h2>Liked Songs</h2></div>${a.map(row).join('')||'<div class="empty">Songs you like will appear here.</div>'}</div></div>`;
  $('#createPlaylistBtn').onclick=()=>openPlaylistModal(); $$('.playlist-tile').forEach(b=>b.onclick=()=>showPlaylist(b.dataset.pid));
}

function showMsg(t,type='info'){const e=$('#toast');e.textContent=t;e.className='toast '+type;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3500)}
function setAuthMode(){signup=!signup;$('#at').textContent=signup?'Create account':'Welcome back';$('#as').textContent=signup?'Join RedWave and start listening.':'Log in to continue listening.';$('#an').classList.toggle('hide',!signup);$('#authSubmit').textContent=signup?'Sign up':'Log in';$('#toggle').textContent=signup?'Already have an account? Log in':'Create an account';$('#forgot').classList.toggle('hide',signup);$('#err').textContent=''}
$('#toggle').onclick=setAuthMode;
$('#forgot').onclick=async()=>{$('#auth').classList.add('hide');$('#reset').classList.remove('hide');$('#resetEmail').focus()};
$('#cancelReset').onclick=()=>{$('#reset').classList.add('hide');$('#auth').classList.remove('hide')};
$('#resetForm').onsubmit=async e=>{e.preventDefault();const email=$('#resetEmail').value.trim();const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:AUTH_REDIRECT+'?reset=1'});if(error)$('#resetMsg').textContent=error.message;else{$('#resetMsg').textContent='Reset email sent. Check your inbox and follow the secure link to create a new password.';$('#resetForm button[type=submit]').disabled=true}};
$('#updateForm').onsubmit=async e=>{e.preventDefault();const btn=e.submitter||$('#updateForm button');const p=$('#newPassword').value;$('#updateMsg').style.color='';if(p.length<6)return $('#updateMsg').textContent='Password must be at least 6 characters.';if(p!==$('#confirmPassword').value)return $('#updateMsg').textContent='Passwords do not match.';btn.disabled=true;btn.textContent='Changing…';const {error}=await supabase.auth.updateUser({password:p});if(error){$('#updateMsg').textContent=authError(error);btn.disabled=false;btn.textContent='Change password';}else{$('#updateMsg').style.color='#7fe0a0';$('#updateMsg').textContent='Password changed successfully. You can now log in.';await supabase.auth.signOut();setTimeout(()=>{location.replace(AUTH_REDIRECT)},1000)}};
$('#af').onsubmit=async e=>{e.preventDefault();$('#err').textContent='';const email=$('#ae').value.trim().toLowerCase(),password=$('#ap').value;if(signup){const {data,error}=await supabase.auth.signUp({email,password,options:{data:{name:$('#an').value.trim()||'Listener'},emailRedirectTo:AUTH_REDIRECT}});if(error)return $('#err').textContent=authError(error);if(data.session){location.reload()}else $('#err').textContent='Account created. Check your email to confirm your account, then log in.'}else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)return $('#err').textContent=authError(error);location.reload()}};
$('#logout').onclick=async()=>{await supabase.auth.signOut();location.reload()};
async function openProfilePanel(){const p=currentProfile||await refreshUserBadge();const {data:{user}}=await supabase.auth.getUser();$('#pfAvatar').src=p?.avatar_url||fallback;$('#pfName').value=p?.name||'';$('#pfEmail').value=user?.email||'';$('#pfAvatarFile').value='';$('#pfMsg').textContent='';$('#profilePanel').classList.remove('hide')}
$('#user').onclick=()=>{const hidden=$('#profilePanel').classList.contains('hide');$('#profilePanel').classList.add('hide');if(hidden)openProfilePanel()};
$('#closeProfile').onclick=()=>$('#profilePanel').classList.add('hide');
document.addEventListener('click',e=>{if(!$('#profilePanel').classList.contains('hide')&&!$('#profilePanel').contains(e.target)&&!$('#user').contains(e.target))$('#profilePanel').classList.add('hide')});
$('#pfAvatarBtn').onclick=()=>$('#pfAvatarFile').click();
$('#pfAvatarFile').onchange=()=>{const f=$('#pfAvatarFile').files[0];if(f)$('#pfAvatar').src=URL.createObjectURL(f)};
$('#profileForm').onsubmit=async e=>{e.preventDefault();$('#pfMsg').textContent='';const btn=$('#pfSave'),prevText=btn.textContent;btn.disabled=true;btn.textContent='Saving…';try{const {data:{user}}=await supabase.auth.getUser();if(!user)throw Error('Your session has expired. Please log in again.');const name=$('#pfName').value.trim()||'Listener';const email=$('#pfEmail').value.trim().toLowerCase();const file=$('#pfAvatarFile').files[0];let avatar_url=currentProfile?.avatar_url||null;if(file)avatar_url=await upload('covers',file,'avatars');const {error:perr}=await supabase.from('profiles').update({name,avatar_url}).eq('id',user.id);if(perr)throw perr;const updates={};if(email&&email!==user.email)updates.email=email;if(Object.keys(updates).length){const {error:aerr}=await supabase.auth.updateUser(updates);if(aerr)throw aerr}await refreshUserBadge();$('#pfAvatarFile').value='';$('#pfMsg').style.color='#7fe0a0';$('#pfMsg').textContent=updates.email?'Saved. Check your new email inbox to confirm the change.':'Profile updated.';showMsg('Profile updated.','info')}catch(err){$('#pfMsg').style.color='#ff9aa3';$('#pfMsg').textContent=authError(err)}finally{btn.disabled=false;btn.textContent=prevText}};
$('#search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,140)};$('#volume').oninput=e=>$('#audio').volume=e.target.value;$('#lyricsToggle').onclick=()=>{const box=$('#lyrics'),btn=$('#lyricsToggle');if(!box)return;const open=box.classList.toggle('hide')===false;btn.setAttribute('aria-expanded',open?'true':'false');btn.textContent=open?'✕ Hide Lyrics':'♫ Lyrics';document.body.classList.toggle('lyrics-open',open);if(open&&current)renderLyrics($('#audio').currentTime||0)};$('#lyricsClose').onclick=()=>{$('#lyrics').classList.add('hide');$('#lyricsToggle').setAttribute('aria-expanded','false');$('#lyricsToggle').textContent='♫ Lyrics';document.body.classList.remove('lyrics-open')};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#lyrics').classList.contains('hide'))$('#lyricsClose').click()});$('#play').onclick=async()=>{const a=$('#audio');if(!a.src){if(current)await playSong(current.id);return;}if(a.paused){try{await a.play();$('#play').textContent='❚❚'}catch(err){console.error(err);showMsg('Could not start playback. Check the song audio URL.','info')}}else{a.pause();$('#play').textContent='▶'}};$('#next').onclick=next;$('#rewind5').onclick=()=>seekBy(-5);$('#forward5').onclick=()=>seekBy(5);$('#prev').onclick=prev;$('#likecur').onclick=()=>current&&like(current.id);$('#prog').oninput=e=>{const a=$('#audio');if(a.duration)a.currentTime=a.duration*e.target.value/100};let lastAudioUi=0;$('#audio').ontimeupdate=()=>{const a=$('#audio'),now=performance.now();if(now-lastAudioUi<200&&currentLyrics.length===0)return;lastAudioUi=now;$('#prog').value=a.duration?a.currentTime/a.duration*100:0;$('#el').textContent=fmt(a.currentTime);$('#du').textContent=fmt(a.duration);renderLyrics(a.currentTime)};$('#audio').onplay=()=>{
  $('#play').textContent='❚❚';
  $('#playerBar')?.classList.remove('hide');
};
$('#audio').onpause=()=>{
  // Keep the player visible while paused so the user can resume playback.
  $('#play').textContent='▶';
};
$('#audio').onerror=()=>{
  console.error('Audio element error', $('#audio').error, current);
  $('#play').textContent='▶';
  $('#playerBar')?.classList.add('hide');
  if(current)showMsg('The audio file could not be loaded. Check its Supabase Storage URL and bucket access.','info');
};
$('#audio').onended=()=>{
  $('#playerBar')?.classList.add('hide');
  next();
};
$$('.nav').forEach(b=>b.onclick=()=>{$$('.nav').forEach(x=>x.classList.remove('active'));b.classList.add('active');const main=document.querySelector('main');if(main)main.scrollTop=0;b.dataset.v==='home'?home():b.dataset.v==='search'?search():library()});$('#liked').onclick=()=>{const main=document.querySelector('main');if(main)main.scrollTop=0;library()};
$('#createPlaylistSide').onclick=openPlaylistModal;
$('#closeSongPicker').onclick=()=>$('#songPickerModal').classList.add('hide');
$('#songPickerModal').onclick=e=>{if(e.target.id==='songPickerModal')$('#songPickerModal').classList.add('hide')};
$('#addCurrentToPlaylist').onclick=addCurrentSongToPlaylist;
$('#closePlaylistModal').onclick=closePlaylistModal;
$('#playlistModal').onclick=e=>{if(e.target.id==='playlistModal')closePlaylistModal()};
$('#playlistCoverBtn').onclick=()=>$('#playlistCoverFile').click();
$('#playlistCoverFile').onchange=async()=>{try{const f=$('#playlistCoverFile').files[0];if(f){$('#playlistMsg').textContent='Processing cover…';playlistCoverData=await readPlaylistCover(f);$('#playlistCoverPreview').src=playlistCoverData;$('#playlistMsg').textContent='Cover selected.'}}catch(err){playlistCoverData=null;$('#playlistMsg').textContent=err.message||'Could not read the image.'}};
async function handlePlaylistSubmit(e){
  if(e)e.preventDefault();
  const btn=$('#playlistSubmit'), msg=$('#playlistMsg'), name=$('#playlistName').value;
  if(!name.trim()){msg.textContent='Please enter a playlist name.';$('#playlistName').focus();return false;}
  btn.disabled=true; const old=btn.textContent; btn.textContent=editingPlaylistId?'Saving…':'Creating…'; msg.textContent='';
  try{await createOrUpdatePlaylist(name); return true;}
  catch(err){console.error('Playlist creation failed:',err);msg.textContent=err?.message||'Could not create playlist. Please try again.';return false;}
  finally{btn.disabled=false;btn.textContent=old;}
}
$('#playlistForm').addEventListener('submit',handlePlaylistSubmit);
$('#playlistSubmit').onclick=(e)=>{e.preventDefault(); handlePlaylistSubmit(e);};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePlaylistModal()});
async function showAuthenticated(){ await renderPlaylistSidebar(); $('#auth').classList.add('hide'); $('#reset').classList.add('hide'); $('#update').classList.add('hide'); $('#app').classList.remove('hide'); await home(); }
function showRecovery(){ $('#auth').classList.add('hide'); $('#reset').classList.add('hide'); $('#app').classList.add('hide'); $('#update').classList.remove('hide'); $('#newPassword').focus(); }
async function boot(){
 if(location.protocol==='file:'){ $('#err').textContent='Please open RedWave through a web server. Password reset cannot complete from a file:// URL.'; }
 const recovery=location.search.includes('reset=1')||location.hash.includes('type=recovery');
 const {data:{session}}=await supabase.auth.getSession();
 if(recovery){
   if(session){ showRecovery(); }
   else {
     $('#updateMsg').textContent='Opening secure password reset…';
     // Supabase may finish processing the recovery URL immediately after getSession().
     setTimeout(async()=>{ const {data:{session:latest}}=await supabase.auth.getSession(); if(latest) showRecovery(); else $('#updateMsg').textContent='This reset link is invalid or expired. Please request a new password-reset email.'; },1000);
   }
   return;
 }
 if(!session){$('#auth').classList.remove('hide');$('#app').classList.add('hide');return;}
 await showAuthenticated();
}
supabase.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY' && session) showRecovery();
 else if(event==='SIGNED_IN' && session && !location.search.includes('reset=1')) showAuthenticated();
 else if(event==='SIGNED_OUT') location.reload();
});
boot();
