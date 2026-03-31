 
// ================== STATE ==================
let state = {
  recording: false,
  recognition: null,
  transcript: '',
  timer: null,
  seconds: 0,
  language: 'ar-SA',
  medications: [],
  symptoms: [],
  diagnoses: []
};

// ================== INIT ==================
window.onload = () => {
  buildWaves();
  document.getElementById('prescDate').valueAsDate = new Date();
  setupTagsInput('symptomsInput', 'symptomsTags', state.symptoms);
  setupTagsInput('diagnosisInput', 'diagnosisTags', state.diagnoses);
};

// LANGUAGE SELECTION
document.querySelectorAll('.lang-chip').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.lang-chip').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.language = btn.dataset.lang;
  };
});

// ================== WAVE BARS ==================
function buildWaves() {
  const c = document.getElementById('waveContainer');
  c.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const b = document.createElement('div');
    b.className = 'wave-bar';
    b.style.height = '4px';
    c.appendChild(b);
  }
}

function animateWaves() {
  const bars = document.querySelectorAll('.wave-bar');
  bars.forEach(b => {
    b.classList.add('active');
    const h = Math.random() * 50 + 4;
    b.style.height = h + 'px';
  });
}

// ================== RECORDING ==================
function toggleRecording() {
  if (!state.recording) startRecording();
}

function startRecording() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('⚠️ المتصفح لا يدعم التعرف على الصوت. استخدم Chrome أو Edge', 'error');
    // Demo mode fallback
    demoMode();
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.recognition = new SR();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = state.language;

  let finalTranscript = '';

  state.recognition.onstart = () => {
    state.recording = true;
    document.getElementById('micBtn').classList.add('recording');
    document.getElementById('micBtn').textContent = '🔴';
    document.getElementById('recordStatusText').textContent = '● جاري التسجيل...';
    document.getElementById('recordTimer').classList.add('recording');
    document.getElementById('stopBtn').style.display = 'inline-flex';
    document.getElementById('proceedBtn').style.display = 'none';
    document.getElementById('liveTranscript').innerHTML = '<span class="live-text">يستمع...</span>';
    startTimer();
    state.waveInterval = setInterval(animateWaves, 150);
  };

  state.recognition.onresult = (e) => {
    let interimTranscript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTranscript += t + ' ';
      else interimTranscript += t;
    }
    document.getElementById('liveTranscript').innerHTML =
      `<span style="color:var(--text)">${finalTranscript}</span><span style="color:var(--text-muted)">${interimTranscript}</span>`;
    state.transcript = finalTranscript + interimTranscript;
  };

  state.recognition.onerror = (e) => {
    if (e.error !== 'aborted') {
      showToast('⚠️ خطأ: ' + e.error, 'error');
    }
  };

  state.recognition.onend = () => {
    if (state.recording) state.recognition.start();
  };

  state.recognition.start();
}

function stopRecording() {
  state.recording = false;
  if (state.recognition) {
    state.recognition.onend = null;
    state.recognition.stop();
  }
  clearInterval(state.timer);
  clearInterval(state.waveInterval);

  document.getElementById('micBtn').classList.remove('recording');
  document.getElementById('micBtn').textContent = '✓';
  document.getElementById('recordStatusText').textContent = '✓ تم إيقاف التسجيل';
  document.getElementById('recordTimer').classList.remove('recording');
  document.getElementById('stopBtn').style.display = 'none';

  const bars = document.querySelectorAll('.wave-bar');
  bars.forEach(b => { b.classList.remove('active'); b.style.height = '4px'; });

  if (state.transcript.trim()) {
    document.getElementById('proceedBtn').style.display = 'inline-flex';
    showToast('✓ تم التسجيل بنجاح', 'success');
  } else {
    showToast('⚠️ لم يتم التعرف على صوت. جرّب مرة أخرى.', 'error');
    document.getElementById('micBtn').textContent = '🎙️';
    document.getElementById('recordStatusText').textContent = 'اضغط للبدء في التسجيل';
  }
}

function demoMode() {
  // Demo for non-Chrome browsers
  state.recording = true;
  document.getElementById('micBtn').classList.add('recording');
  document.getElementById('micBtn').textContent = '🔴';
  document.getElementById('recordStatusText').textContent = '● وضع العرض التجريبي';
  document.getElementById('recordTimer').classList.add('recording');
  document.getElementById('stopBtn').style.display = 'inline-flex';
  startTimer();
  state.waveInterval = setInterval(animateWaves, 150);

  // Simulate live text
  const demoText = 'مريض ذكر عمره 42 سنة يشكو من ألم في الحلق وارتفاع في درجة الحرارة منذ يومين مع سعال جاف وصعوبة في البلع، لا يوجد حساسية من الأدوية، لم يتناول أي مدة علاجية سابقة.';
  let i = 0;
  state.demoInterval = setInterval(() => {
    i += 3;
    if (i >= demoText.length) {
      i = demoText.length;
      clearInterval(state.demoInterval);
    }
    const partial = demoText.slice(0, i);
    document.getElementById('liveTranscript').innerHTML = `<span style="color:var(--text)">${partial}</span>`;
    state.transcript = partial;
  }, 60);
}

// ================== TIMER ==================
function startTimer() {
  state.seconds = 0;
  state.timer = setInterval(() => {
    state.seconds++;
    const m = String(Math.floor(state.seconds / 60)).padStart(2, '0');
    const s = String(state.seconds % 60).padStart(2, '0');
    document.getElementById('recordTimer').textContent = `${m}:${s}`;
  }, 1000);
}

// ================== STEP NAVIGATION ==================
function goToStep2() {
  if (!state.transcript.trim()) { showToast('⚠️ يرجى تسجيل الحالة أولاً', 'error'); return; }
  activateStep(2);
  document.getElementById('transcriptEdit').value = state.transcript.trim();

  // Detect language hint
  const hasArabic = /[\u0600-\u06FF]/.test(state.transcript);
  document.getElementById('detectedLang').textContent = hasArabic ? '🇸🇦 عربية' : '🌐 Latin';
}

function goToStep1() { activateStep(1); }
function goToStep2Back() { activateStep(2); }
function goToStep3() { activateStep(3); document.getElementById('prescriptionForm').style.display = 'block'; document.getElementById('aiGenerating').style.display = 'none'; }

async function generatePrescription() {
  const text = document.getElementById('transcriptEdit').value.trim();
  if (!text) { showToast('⚠️ النص فارغ', 'error'); return; }

  activateStep(3);
  document.getElementById('aiGenerating').style.display = 'block';
  document.getElementById('prescriptionForm').style.display = 'none';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `أنت مساعد طبي ذكي. بناءً على وصف الحالة التالية، أنشئ معاينة ووصفة طبية كاملة.

الحالة المرضية: """${text}"""

أعد الرد بصيغة JSON فقط (بدون markdown أو أي نص آخر) بهذا الشكل:
{
  "patientName": "غير محدد",
  "patientAge": "العمر المذكور أو غير محدد",
  "patientGender": "الجنس المذكور أو غير محدد",
  "symptoms": ["عرض 1", "عرض 2"],
  "diagnoses": ["تشخيص 1", "تشخيص 2"],
  "medications": [
    {"name": "اسم الدواء والجرعة", "dose": "الجرعة", "frequency": "التكرار", "duration": "المدة", "timing": "توقيت الأخذ"}
  ],
  "advice": "نصائح وتعليمات للمريض",
  "followUp": "موعد المتابعة"
}`
        }]
      })
    });

    const data = await response.json();
    const raw = data.content.map(i => i.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    fillPrescriptionForm(result);

  } catch (err) {
    // Demo fallback
    fillPrescriptionForm(getDemoData(text));
  }
}

function getDemoData(text) {
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  return {
    patientName: 'غير محدد',
    patientAge: '35 سنة',
    patientGender: 'ذكر',
    symptoms: ['ألم في الحلق', 'ارتفاع الحرارة', 'سعال جاف'],
    diagnoses: ['التهاب اللوزتين الحاد', 'التهاب البلعوم'],
    medications: [
      { name: 'أموكسيسيلين 500mg', dose: '1 كبسولة', frequency: '3 مرات يومياً', duration: '7 أيام', timing: 'بعد الأكل' },
      { name: 'باراسيتامول 500mg', dose: '2 حبة', frequency: 'كل 8 ساعات', duration: '3 أيام', timing: 'عند الحاجة' },
      { name: 'غرغرة كلورهيكسيدين', dose: '15 مل', frequency: '3 مرات يومياً', duration: '5 أيام', timing: 'بعد الأكل' }
    ],
    advice: 'الراحة التامة في المنزل — الإكثار من السوائل الدافئة — تجنب الأطعمة الحارة والمشروبات الباردة — ارتداء الملابس الدافئة — التوقف عن التدخين إن وجد',
    followUp: 'بعد أسبوع إذا لم تتحسن الحالة'
  };
}

function fillPrescriptionForm(data) {
  document.getElementById('aiGenerating').style.display = 'none';
  document.getElementById('prescriptionForm').style.display = 'block';

  document.getElementById('patientName').value = data.patientName || '';
  document.getElementById('patientAge').value = data.patientAge || '';
  document.getElementById('patientGender').value = data.patientGender || '';
  document.getElementById('adviceText').value = data.advice || '';
  document.getElementById('followUp').value = data.followUp || '';

  // Symptoms
  state.symptoms = data.symptoms || [];
  renderTags('symptomsTags', state.symptoms, 'symptoms');

  // Diagnoses
  state.diagnoses = data.diagnoses || [];
  renderTags('diagnosisTags', state.diagnoses, 'diagnoses');

  // Medications
  state.medications = data.medications || [];
  renderMedications();

  showToast('✓ تم توليد المعاينة والوصفة بنجاح', 'success');
}

// ================== TAGS SYSTEM ==================
function setupTagsInput(inputId, tagsId, arr) {
  const input = document.getElementById(inputId);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const val = input.value.trim();
      arr.push(val);
      input.value = '';
      const type = inputId.includes('symptoms') ? 'symptoms' : 'diagnoses';
      renderTags(tagsId, arr, type);
    }
  });
}

function renderTags(containerId, arr, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = arr.map((tag, i) =>
    `<span class="diagnosis-tag">${tag} <span class="remove" onclick="removeTag('${type}', ${i})">×</span></span>`
  ).join('');
}

function removeTag(type, index) {
  if (type === 'symptoms') { state.symptoms.splice(index, 1); renderTags('symptomsTags', state.symptoms, 'symptoms'); }
  else { state.diagnoses.splice(index, 1); renderTags('diagnosisTags', state.diagnoses, 'diagnoses'); }
}

// ================== MEDICATIONS ==================
function renderMedications() {
  const list = document.getElementById('medicationsList');
  list.innerHTML = state.medications.map((med, i) => `
    <div class="med-item">
      <div>
        <div class="med-name">💊 ${med.name}</div>
        <div class="med-detail">${med.dose} — ${med.timing}</div>
      </div>
      <div class="med-badge">${med.frequency}</div>
      <div class="med-duration">⏱️ ${med.duration}</div>
      <button class="med-remove" onclick="removeMed(${i})">🗑️</button>
    </div>
  `).join('');
}

function removeMed(i) { state.medications.splice(i, 1); renderMedications(); }

function openAddMedModal() { document.getElementById('addMedModal').classList.add('open'); }
function closeAddMedModal() { document.getElementById('addMedModal').classList.remove('open'); }

function addMedication() {
  const name = document.getElementById('medName').value.trim();
  if (!name) { showToast('⚠️ أدخل اسم الدواء', 'error'); return; }
  state.medications.push({
    name,
    dose: document.getElementById('medDose').value || '',
    frequency: document.getElementById('medFreq').value,
    duration: document.getElementById('medDuration').value || '',
    timing: document.getElementById('medTiming').value
  });
  renderMedications();
  document.getElementById('medName').value = '';
  document.getElementById('medDose').value = '';
  document.getElementById('medDuration').value = '';
  closeAddMedModal();
  showToast('✓ تم إضافة الدواء', 'success');
}

// ================== STEP 4: PRINT ==================
function goToStep4() {
  activateStep(4);
  buildPrintPreview();
}

function buildPrintPreview() {
  const name = document.getElementById('patientName').value || 'غير محدد';
  const age = document.getElementById('patientAge').value || '';
  const gender = document.getElementById('patientGender').value || '';
  const date = document.getElementById('prescDate').value || new Date().toLocaleDateString('ar-SA');
  const followUp = document.getElementById('followUp').value;
  const advice = document.getElementById('adviceText').value;

  const diagTagsHTML = state.diagnoses.map(d => `<span class="print-diag-tag">${d}</span>`).join('');
  const sympTagsHTML = state.symptoms.map(s => `<span class="print-diag-tag" style="background:#fff8e1;border-color:#ffe082;color:#795548">${s}</span>`).join('');

  const medsHTML = state.medications.length > 0 ? `
    <table class="print-med-table">
      <thead><tr><th>اسم الدواء</th><th>الجرعة</th><th>التكرار</th><th>المدة</th><th>الملاحظات</th></tr></thead>
      <tbody>
        ${state.medications.map(m => `<tr>
          <td><strong>${m.name}</strong></td>
          <td>${m.dose}</td>
          <td>${m.frequency}</td>
          <td>${m.duration}</td>
          <td>${m.timing}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  ` : '<p style="color:#888;font-size:14px">لا توجد أدوية</p>';

  document.getElementById('printPreview').innerHTML = `
    <div class="print-watermark">Rx</div>
    <div class="print-header">
      <div>
        <div class="print-clinic-name">⚕️ المساعد الطبي الذكي</div>
        <div class="print-doctor-info">Dr. AI Assistant — نظام المعاينات الطبية<br>تاريخ الإصدار: ${date}</div>
      </div>
      <div class="print-rx-symbol">Rx</div>
    </div>

    <div class="print-patient-row">
      <span>المريض: <strong>${name}</strong></span>
      ${age ? `<span>العمر: <strong>${age}</strong></span>` : ''}
      ${gender ? `<span>الجنس: <strong>${gender}</strong></span>` : ''}
      <span>التاريخ: <strong>${date}</strong></span>
    </div>

    ${sympTagsHTML ? `<div class="print-section-title">الأعراض</div><div class="print-diagnosis-tags">${sympTagsHTML}</div>` : ''}

    <div class="print-section-title">التشخيص</div>
    <div class="print-diagnosis-tags">${diagTagsHTML || '<span style="color:#888">لم يحدد</span>'}</div>

    <div class="print-section-title">الوصفة الطبية</div>
    ${medsHTML}

    ${advice ? `<div class="print-section-title">التعليمات والنصائح</div>
    <p style="font-size:14px;line-height:1.8;color:#3a4555;padding:12px;background:#f7f9ff;border-radius:8px">${advice.replace(/\n/g, '<br>')}</p>` : ''}

    ${followUp ? `<div class="print-section-title">موعد المتابعة</div>
    <p style="font-size:14px;color:#3a4555;font-weight:600">📅 ${followUp}</p>` : ''}

    <div class="print-footer">
      <div style="font-size:12px;color:#aaa">
        تم التوليد بواسطة Dr. AI Assistant<br>
        هذه الوصفة تحت إشراف الطبيب المعالج
      </div>
      <div class="print-signature">
        <div class="print-sig-line"></div>
        <div>توقيع الطبيب</div>
      </div>
    </div>
  `;
}

function printPrescription() { window.print(); }

function startNew() {
  state.transcript = '';
  state.medications = [];
  state.symptoms = [];
  state.diagnoses = [];
  state.seconds = 0;
  document.getElementById('micBtn').textContent = '🎙️';
  document.getElementById('micBtn').classList.remove('recording');
  document.getElementById('recordStatusText').textContent = 'اضغط للبدء في التسجيل';
  document.getElementById('recordTimer').textContent = '00:00';
  document.getElementById('recordTimer').classList.remove('recording');
  document.getElementById('liveTranscript').innerHTML = '<span class="transcript-placeholder">سيظهر النص هنا أثناء التسجيل...</span>';
  document.getElementById('stopBtn').style.display = 'none';
  document.getElementById('proceedBtn').style.display = 'none';
  buildWaves();
  activateStep(1);
  showToast('✓ جاهز لحالة جديدة', 'success');
}

// ================== STEP ACTIVATION ==================
function activateStep(n) {
  for (let i = 1; i <= 4; i++) {
    const panel = document.getElementById('panel' + i);
    const step = document.getElementById('step' + i);
    const circle = step.querySelector('.step-circle');

    panel.classList.toggle('active', i === n);
    step.classList.toggle('active', i === n);
    step.classList.toggle('done', i < n);
    circle.classList.toggle('active', i === n);
    circle.classList.toggle('done', i < n);

    if (i < n) {
      const icons = ['🎙️', '📝', '🤖', '🖨️'];
      circle.textContent = '✓';
    } else {
      const icons = ['🎙️', '📝', '🤖', '🖨️'];
      if (i !== 1 || !circle.classList.contains('done')) {
        circle.textContent = i === n ? icons[i - 1] : icons[i - 1];
      }
    }
  }

  for (let i = 1; i <= 3; i++) {
    const conn = document.getElementById('conn' + i);
    conn.classList.toggle('active', i < n);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================== TOAST ==================
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}
 