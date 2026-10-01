const supabase=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});const $=s=>document.querySelector(s);let currentUser=null;
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function getProfile(){const {data:{user}}=await supabase.auth.getUser();if(!user)return null;currentUser=user;const {data}=await supabase.from('profiles').select('id,name,role').eq('id',user.id).maybeSingle();return data}
async function gate(){const p=await getProfile();if(!p){$('#login').classList.remove('hide');$('#app').classList.add('hide');return}if(p.role!=='admin'){await supabase.auth.signOut();$('#login').classList.remove('hide');$('#app').classList.add('hide');$('#msg').textContent='Access denied. Only RedWave administrators can open the Admin Panel.';return}$('#login').classList.add('hide');$('#app').classList.remove('hide');dashboard()}
$('#loginForm').onsubmit=async e=>{e.preventDefault();$('#msg').textContent='';const {error}=await supabase.auth.signInWithPassword({email:$('#email').value.trim().toLowerCase(),password:$('#password').value});if(error)return $('#msg').textContent=/invalid login credentials/i.test(error.message)?'Incorrect email or password.':error.message;gate()};$('#logout').onclick=async()=>{await supabase.auth.signOut();location.reload()};
async function count(table){const {count}=await supabase.from(table).select('*',{count:'exact',head:true});return count||0}
async function dashboard(){$('#title').textContent='Dashboard';const [s,u]=await Promise.all([count('songs'),count('profiles')]);$('#panel').innerHTML=`<div class='stats'><div class='stat'><b>${s}</b><small>Songs</small></div><div class='stat'><b>${u}</b><small>Registered users</small></div></div><div class='box'><h2>Publish music</h2><p class='muted'>Upload an MP3 and cover image. The song will be saved to Supabase and immediately become available on the main website.</p><button class='save' onclick='addSong()'>＋ Add Music</button></div>`}
async function listSongs(){$('#title').textContent='Music Library';const {data,error}=await supabase.from('songs').select('*').order('created_at',{ascending:false});if(error)return $('#panel').innerHTML=`<div class='box error'>${esc(error.message)}</div>`;$('#panel').innerHTML=`<div class='box'>${(data||[]).map(s=>`<div class='song'><img src='${esc(s.cover_url||'../assets/default.svg')}' onerror="this.src='../assets/default.svg'"><div><b>${esc(s.title)}</b><small>${esc(s.artist)} • ${esc(s.album||'Single')} • ${esc(s.genre||'')}</small></div><div class='actions'><button class='save' onclick='editSong(${s.id})'>Edit</button><button class='danger' onclick='deleteSong(${s.id})'>Delete</button></div></div>`).join('')||'<div class="empty">No music yet.</div>'}</div>`}
async function upload(bucket,file,folder){if(!file)return null;const ext=(file.name.split('.').pop()||'bin').toLowerCase();const path=`${folder}/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type||undefined,cacheControl:'31536000',upsert:false});if(error)throw error;return path}
async function duration(file){if(!file)return 0;return await new Promise(resolve=>{const a=document.createElement('audio');a.preload='metadata';a.onloadedmetadata=()=>{URL.revokeObjectURL(a.src);resolve(Math.round(a.duration)||0)};a.onerror=()=>resolve(0);a.src=URL.createObjectURL(file)})}
function musicMetaFromFile(file){
  if(!file||!file.name) return {title:'',artist:''};
  let name=file.name.replace(/\\/g,'/').split('/').pop().replace(/\.[^.]+$/,'');
  name=name.replace(/[._]+/g,' ').replace(/\s+/g,' ').trim();
  name=name.replace(/^\s*(?:track\s*)?\d{1,3}\s*[-.)_]\s*/i,'');
  name=name.replace(/\s*[\[(]?(?:official\s*)?(?:audio|video|lyrics?|lyric video)[\])]*\s*$/i,'').trim();

  let title=name, artist='';

  // Common filename formats:
  // "Song Title - Artist", "Song Title by Artist", "Artist - Song Title",
  // "Song Title (Artist)", and "Song Title feat Artist".
  let m=name.match(/^(.+?)\s+(?:by)\s+(.+)$/i);
  if(m){
    title=m[1].trim(); artist=m[2].trim();
  }else{
    m=name.match(/^(.+?)\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i);
    if(m){
      title=m[1].trim(); artist=m[2].trim();
    }else{
      m=name.match(/^(.+?)\s*[\(\[]\s*([^()\[\]]+)\s*[\)\]]$/);
      if(m && !/official|audio|video|lyrics?/i.test(m[2])){
        title=m[1].trim(); artist=m[2].trim();
      }else{
        const parts=name.split(/\s*[-–—]\s*/).map(x=>x.trim()).filter(Boolean);
        if(parts.length===2){
          // RedWave convention: "Song Title - Artist"
          title=parts[0]; artist=parts[1];
        }else if(parts.length>=3 && /^(?:remix|version|mix|edit)$/i.test(parts[parts.length-1])){
          artist=parts[parts.length-2];
          title=parts.slice(0,-2).join(' - ');
        }
      }
    }
  }

  artist=artist.replace(/^\s*(?:by|feat\.?|ft\.?|featuring)\s+/i,'').trim();
  title=title.replace(/\s{2,}/g,' ').trim();
  artist=artist.replace(/\s{2,}/g,' ').trim();

  return {title:title||'Untitled song',artist};
}
function musicTitleFromFile(file){return musicMetaFromFile(file).title}
function wireAudioTitle(){
  const input=$('#audio'), title=$('#t'), artist=$('#a');
  if(!input||!title)return;

  let generatedTitle='';
  let generatedArtist='';

  input.onchange=()=>{
    const file=input.files?.[0];
    if(!file)return;

    const meta=musicMetaFromFile(file);
    if(meta.title){
      const current=title.value.trim();
      if(!current || title.dataset.userEdited!=='true' || current===generatedTitle){
        title.value=meta.title;
        generatedTitle=meta.title;
        title.dataset.userEdited='false';
      }
    }

    if(artist && meta.artist){
      const currentArtist=artist.value.trim();
      if(!currentArtist || artist.dataset.userEdited!=='true' || currentArtist===generatedArtist){
        artist.value=meta.artist;
        generatedArtist=meta.artist;
        artist.dataset.userEdited='false';
      }
    }
  };

  title.oninput=()=>{ title.dataset.userEdited='true'; };
  if(artist) artist.oninput=()=>{ artist.dataset.userEdited='true'; };
}
function addSong(id){$('#title').textContent=id?'Edit Music':'Add Music';$('#panel').innerHTML=`<div class='box'><form class='form' id='songForm'><div class='field'><label>Song title *</label><input id='t' required></div><div class='field'><label>Artist *</label><input id='a' required></div><div class='field'><label>Album</label><input id='al'></div><div class='field'><label>Genre</label><input id='g'></div><div class='field full'><label>Cover image</label><input id='cover' type='file' accept='image/*'><small class='muted'>JPG, PNG or WebP</small></div><div class='field full'><label>Audio file</label><input id='audio' type='file' accept='audio/mpeg,audio/mp3,audio/*'><div id='currentAudio' class='current-file muted'></div><small class='muted'>${id?'Leave this empty to keep the existing audio file. Choose a new file only if you want to replace it.':'MP3 recommended. Large files may take longer to upload.'}</small></div><div class='field full'><label>Description</label><textarea id='d'></textarea></div><div class='field full'><label>Lyrics</label><textarea id='lyrics' rows='10' placeholder='Paste lyrics here, one line per row, or use Auto-generate after selecting an audio file.'></textarea><div class='lyrics-tools'><button type='button' class='secondary' id='genLyrics'>✨ Auto-generate lyrics</button><small class='muted'>Generates timestamped lines from the uploaded audio using the configured AI transcription function.</small></div></div><button class='save' id='publish'>${id?'Save changes':'Publish music'}</button></form></div>`;wireLyricsButton();wireAudioTitle();if(id)fillEdit(id);$('#songForm').onsubmit=async e=>{e.preventDefault();const btn=$('#publish');btn.disabled=true;btn.textContent='Uploading…';try{const {data:{user}}=await supabase.auth.getUser();if(!user)throw Error('Admin session expired.');let existing=id?(await supabase.from('songs').select('*').eq('id',id).single()).data:null;const cf=$('#cover').files[0],af=$('#audio').files[0];const coverUrl=cf?await upload('covers',cf,'songs'):existing?.cover_url||null;const audioUrl=af?await upload('music',af,'songs'):existing?.audio_url;if(!audioUrl)throw Error('Please choose an audio file.');const row={title:$('#t').value.trim(),artist:$('#a').value.trim(),album:$('#al').value.trim()||null,genre:$('#g').value.trim()||null,description:$('#d').value.trim()||null,lyrics:$('#lyrics').value.trim()||null,cover_url:coverUrl,audio_url:audioUrl,duration:af?await duration(af):(existing?.duration||0),created_by:user.id};const result=id?await supabase.from('songs').update(row).eq('id',id):await supabase.from('songs').insert(row);if(result.error)throw result.error;listSongs()}catch(err){alert(err.message)}finally{btn.disabled=false;btn.textContent=id?'Save changes':'Publish music'}}}
function wireLyricsButton(){const b=$('#genLyrics');if(!b)return;b.onclick=async()=>{const af=$('#audio').files[0];if(!af)return alert('Choose an audio file first, or save the song and edit it again.');if(af.size>25*1024*1024)return alert('Please use an audio file under 25 MB for Auto-generate lyrics.');const {data:{session}}=await supabase.auth.getSession();if(!session)return alert('Your admin session expired. Please sign in again.');b.disabled=true;b.textContent='⏳ Generating…';const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),90000);try{const fd=new FormData();fd.append('audio',af);fd.append('title',$('#t').value.trim());fd.append('artist',$('#a').value.trim());const r=await fetch(`${window.SUPABASE_URL}/functions/v1/generate-lyrics`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:fd,signal:controller.signal});const raw=await r.text();let j={};try{j=JSON.parse(raw)}catch{}if(!r.ok)throw Error(j.error||`Lyrics service returned HTTP ${r.status}.`);if(!Array.isArray(j.lyrics)||!j.lyrics.length)throw Error('The audio was transcribed, but no lyrics lines were returned.');$('#lyrics').value=JSON.stringify(j.lyrics,null,2);alert(j.warning?`Lyrics generated with a fallback.\n\n${j.warning}`:'Lyrics generated in English/Hinglish. Review them and then publish/save.')}catch(e){alert(e.name==='AbortError'?'Lyrics generation timed out after 90 seconds. Try a shorter/compressed MP3.':(e.message||'Could not generate lyrics.'))}finally{clearTimeout(timeout);b.disabled=false;b.textContent='✨ Auto-generate lyrics'}}}

async function fillEdit(id){const {data,error}=await supabase.from('songs').select('*').eq('id',id).single();if(error||!data){alert(error?.message||'Song could not be loaded.');return}$('#t').value=data.title||'';$('#a').value=data.artist||'';$('#al').value=data.album||'';$('#g').value=data.genre||'';$('#d').value=data.description||'';$('#lyrics').value=typeof data.lyrics==='string'?data.lyrics:JSON.stringify(data.lyrics||[],null,2);const af=$('#currentAudio');if(af){af.innerHTML=data.audio_url?`Current audio: <span>🔒 Private storage — a temporary signed URL is generated only when the song is played.</span>`:'No audio file is currently attached.'}const cf=$('#cover');if(cf&&data.cover_url){const wrap=document.createElement('div');wrap.className='current-cover';wrap.innerHTML=`Current cover:<br><img src="${esc(data.cover_url)}" alt="Current cover" style="width:72px;height:72px;object-fit:cover;border-radius:8px;margin-top:6px">`;cf.parentElement.appendChild(wrap)}wireLyricsButton()}
async function editSong(id){addSong(id)}async function deleteSong(id){if(!confirm('Delete this song and its database record?'))return;const {error}=await supabase.from('songs').delete().eq('id',id);if(error)alert(error.message);else listSongs()}
function tab(t){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));t==='dashboard'?dashboard():t==='songs'?listSongs():addSong()}document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));gate();
