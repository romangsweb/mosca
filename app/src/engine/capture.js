// Fly Punch · grabar el audio real (p. ej. la mezcla del K.O. sidekick, o cualquier interfaz/micrófono)
// junto con la toma. Se guarda en este navegador; se exporta como WAV.
export async function audioInputs() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const list = await navigator.mediaDevices.enumerateDevices();
  return list.filter((d) => d.kind === 'audioinput').map((d, i) => ({ id: d.deviceId, label: d.label || `Entrada ${i + 1}` }));
}
// sin procesado de voz: queremos el audio tal cual (estéreo, sin cancelar eco ni ganancia automática)
export const rawConstraints = (deviceId) => ({ audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 } });

export class Capture {
  constructor() { this.rec = null; this.stream = null; this.chunks = []; }
  get active() { return !!this.rec; }
  async start(deviceId) {
    this.stream = await navigator.mediaDevices.getUserMedia(rawConstraints(deviceId));
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => window.MediaRecorder?.isTypeSupported?.(t));
    this.chunks = []; this.rec = new MediaRecorder(this.stream, type ? { mimeType: type, audioBitsPerSecond: 256000 } : undefined);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(500);
  }
  stop() {
    return new Promise((res) => {
      if (!this.rec) return res(null);
      const rec = this.rec; this.rec = null;
      rec.onstop = () => { this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null; res(new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' })); };
      rec.stop();
    });
  }
}
