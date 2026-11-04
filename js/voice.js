// Voice chat for a room: WebRTC peer-to-peer audio (mesh), signalling relayed
// through the BOSHX API. Public STUN only: on some mobile networks a direct
// connection cannot be made without a TURN relay, and those peers stay silent.
import { GET, POST } from './api.js';

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

export function createVoice({ code, meId, onChange }) {
  let joined = false, muted = false, stream = null, lastId = 0, pollT = null, joinedAt = 0, destroyed = false;
  const peers = new Map(); // pid -> { pc, audio, state }
  const peerMuted = new Set();
  let members = [];
  const emit = () => onChange?.(status());

  function status() {
    return { joined, muted, peers: [...peers].map(([pid, p]) => ({ pid, state: p.pc.connectionState })), peerMuted: [...peerMuted] };
  }

  function waitIce(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(res => {
      const t = setTimeout(res, 2500);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  }

  function makePeer(pid) {
    closePeer(pid);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const audio = new Audio();
    audio.autoplay = true; audio.playsInline = true; audio.muted = peerMuted.has(pid);
    stream?.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.ontrack = e => { audio.srcObject = e.streams[0]; audio.play().catch(() => {}); emit(); };
    pc.onconnectionstatechange = () => { emit(); if (pc.connectionState === 'failed') closePeer(pid); };
    const p = { pc, audio };
    peers.set(pid, p);
    return p;
  }
  function closePeer(pid) {
    const p = peers.get(pid);
    if (!p) return;
    try { p.pc.close(); } catch { /* */ }
    p.audio.srcObject = null;
    peers.delete(pid);
  }

  const send = (to, type, data) => POST(`/rooms/${code}/signal`, { to, type, data }).catch(() => {});

  async function call(pid) {
    const { pc } = makePeer(pid);
    await pc.setLocalDescription(await pc.createOffer({ offerToReceiveAudio: true }));
    await waitIce(pc);
    send(pid, 'offer', pc.localDescription);
  }

  async function onSignal(s) {
    if (s.ts < joinedAt - 1000) return;
    if (s.type === 'offer') {
      const { pc } = makePeer(s.from);
      await pc.setRemoteDescription(s.data);
      await pc.setLocalDescription(await pc.createAnswer());
      await waitIce(pc);
      send(s.from, 'answer', pc.localDescription);
    } else if (s.type === 'answer') {
      const p = peers.get(s.from);
      if (p && p.pc.signalingState === 'have-local-offer') await p.pc.setRemoteDescription(s.data);
    } else if (s.type === 'bye') closePeer(s.from);
    emit();
  }

  async function poll() {
    if (!joined || destroyed) return;
    try {
      const { signals } = await GET(`/rooms/${code}/signal?after=${lastId}`);
      for (const s of signals) { lastId = Math.max(lastId, s.id); try { await onSignal(s); } catch (e) { console.warn('voice', e); } }
    } catch { /* retry */ }
    pollT = setTimeout(poll, document.hidden ? 3000 : 1000);
  }

  // called with the room's current voice member list
  function update(list) {
    members = list || [];
    if (!joined) return;
    for (const pid of [...peers.keys()]) if (!members.includes(pid)) closePeer(pid);
    for (const pid of members) {
      if (pid === meId || peers.has(pid)) continue;
      if (meId < pid) call(pid).catch(e => console.warn('voice call', e)); // lower id calls, avoids double offers
    }
    emit();
  }

  async function join() {
    if (joined) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Voice is not supported in this browser');
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    joined = true; muted = false; joinedAt = Date.now();
    await POST(`/rooms/${code}/action`, { type: 'voice', on: true });
    poll();
    emit();
  }
  async function leave() {
    if (!joined) return;
    joined = false;
    clearTimeout(pollT);
    for (const pid of [...peers.keys()]) { send(pid, 'bye', null); closePeer(pid); }
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    POST(`/rooms/${code}/action`, { type: 'voice', on: false }).catch(() => {});
    emit();
  }
  function setMuted(m) { muted = m; stream?.getAudioTracks().forEach(t => (t.enabled = !m)); emit(); }
  function togglePeer(pid) {
    if (peerMuted.has(pid)) peerMuted.delete(pid); else peerMuted.add(pid);
    const p = peers.get(pid); if (p) p.audio.muted = peerMuted.has(pid);
    emit();
    return peerMuted.has(pid);
  }
  return {
    join, leave, setMuted, togglePeer, update, status,
    get joined() { return joined; }, get muted() { return muted; },
    async stats() { const out = {}; for (const [pid, p] of peers) { let bytes = 0; (await p.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio') bytes += r.bytesReceived || 0; }); out[pid] = { state: p.pc.connectionState, bytesIn: bytes }; } return out; },
    destroy() { destroyed = true; leave(); },
  };
}
