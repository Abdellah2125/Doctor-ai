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
  diagnoses: [],
  waveInterval: null,
  demoInterval: null,
  isRestarting: false   
};

// ================== INIT ==================
window.onload = () => {
  buildWaves();
  document.getElementById('prescDate').valueAsDate = new Date();
  setupTagsInput('symptomsInput', 'symptomsTags', state.symptoms, 'symptoms');
  setupTagsInput('diagnosisInput', 'diagnosisTags', state.diagnoses, 'diagnoses');
  checkSpeechRecognitionSupport();
};

// Check browser support
function checkSpeechRecognitionSupport() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('⚠️ متصفحك لا يدعم التعرف على الصوت. سيتم استخدام الوضع التجريبي.', 'error');
    setTimeout(() => {
      showToast('💡 استخدم Chrome أو Edge للحصول على أفضل تجربة', 'info');
    }, 2000);
  }
}

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
  if (!c) return;
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

function stopWaveAnimation() {
  if (state.waveInterval) {
    clearInterval(state.waveInterval);
    state.waveInterval = null;
  }
  const bars = document.querySelectorAll('.wave-bar');
  bars.forEach(b => {
    b.classList.remove('active');
    b.style.height = '4px';
  });
}

// ================== RECORDING (IMPROVED) ==================
function toggleRecording() {
  if (!state.recording) {
    startRecording();
  } else {
    stopRecording();
  }
}

async function startRecording() {
  // منع بدء التسجيل إذا كان قيد التشغيل بالفعل
  if (state.recording) {
    showToast('⚠️ التسجيل قيد التشغيل بالفعل', 'info');
    return;
  }
  
  // طلب إذن الميكروفون أولاً
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // فقط للتحقق من الإذن
  } catch (err) {
    showToast('⚠️ يرجى السماح بالوصول إلى الميكروفون', 'error');
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    showToast('⚠️ المتصفح لا يدعم التعرف على الصوت. جارٍ تفعيل الوضع التجريبي...', 'error');
    demoMode();
    return;
  }
  
  try {
    state.recognition = new SpeechRecognition();
    
    // إعدادات محسنة لمنع التكرار
    state.recognition.continuous = false;  // تغيير إلى false لمنع التكرار
    state.recognition.interimResults = true;
    state.recognition.lang = state.language;
    state.recognition.maxAlternatives = 1;  // أخذ أفضل نتيجة فقط
    
    let finalTranscript = '';
    let interimText = '';
    
    state.recognition.onstart = () => {
      state.recording = true;
      const micBtn = document.getElementById('micBtn');
      micBtn.classList.add('recording');
      micBtn.textContent = '🔴';
      document.getElementById('recordStatusText').textContent = '🎤 جاري التسجيل... تحدث الآن';
      document.getElementById('recordTimer').classList.add('recording');
      document.getElementById('stopBtn').style.display = 'inline-flex';
      document.getElementById('proceedBtn').style.display = 'none';
      document.getElementById('liveTranscript').innerHTML = '<span class="live-text">🔊 يستمع...</span>';
      startTimer();
      state.waveInterval = setInterval(animateWaves, 150);
    };
    
    state.recognition.onresult = (e) => {
      interimText = '';
      
      for (let i = 0; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          // إضافة النص النهائي مع مسافة
          if (finalTranscript.length > 0 && !finalTranscript.endsWith(' ')) {
            finalTranscript += ' ';
          }
          finalTranscript += transcript;
        } else {
          interimText += transcript;
        }
      }
      
      // عرض النص المؤقت والنهائي
      const displayText = finalTranscript + (interimText ? ' ' + interimText : '');
      document.getElementById('liveTranscript').innerHTML = 
        `<span style="color:var(--text)">${escapeHtml(displayText)}</span>`;
      state.transcript = displayText;
    };
    
    state.recognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
      
      if (e.error === 'not-allowed') {
        showToast('⚠️ يرجى السماح بالوصول إلى الميكروفون', 'error');
        resetRecordingUI();
      } else if (e.error === 'no-speech') {
        showToast('🎤 لم يتم اكتشاف صوت. حاول التحدث بوضوح', 'info');
        // لا نوقف التسجيل، فقط نعطي تنبيه
      } else if (e.error === 'audio-capture') {
        showToast('⚠️ لا يمكن الوصول إلى الميكروفون', 'error');
        resetRecordingUI();
      } else if (e.error !== 'aborted') {
        showToast('⚠️ خطأ: ' + e.error, 'error');
        resetRecordingUI();
      }
    };
    
    state.recognition.onend = () => {
      // منع إعادة التشغيل التلقائي
      if (state.recording && !state.isRestarting) {
        // إذا كان لا يزال في وضع التسجيل، ننهي التسجيل بشكل طبيعي
        if (state.transcript && state.transcript.trim()) {
          // يوجد نص، ننهي التسجيل بنجاح
          stopRecording();
        } else {
          // لا يوجد نص، نعطي فرصة ثانية
          showToast('🎤 لم يتم التعرف على كلام. حاول مرة أخرى', 'info');
          resetRecordingUI();
        }
      }
    };
    
    state.recognition.start();
    
  } catch (e) {
    console.error('Failed to start recognition:', e);
    showToast('⚠️ فشل في بدء التسجيل. جارٍ تفعيل الوضع التجريبي...', 'error');
    demoMode();
  }
}

function stopRecording() {
  if (state.recognition) {
    try {
      state.isRestarting = true;
      state.recognition.abort();  // استخدام abort بدلاً من stop لمنع إعادة التشغيل
    } catch (e) {
      console.log('Error stopping recognition:', e);
    } finally {
      state.isRestarting = false;
    }
  }
  
  if (state.demoInterval) {
    clearInterval(state.demoInterval);
    state.demoInterval = null;
  }
  
  state.recording = false;
  clearInterval(state.timer);
  stopWaveAnimation();
  
  resetRecordingUI();
  
  if (state.transcript && state.transcript.trim()) {
    document.getElementById('proceedBtn').style.display = 'inline-flex';
    showToast('✓ تم التسجيل بنجاح', 'success');
  } else {
    showToast('⚠️ لم يتم التعرف على صوت. جرّب مرة أخرى.', 'error');
  }
}

function resetRecordingUI() {
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    micBtn.textContent = '🎙️';
    micBtn.classList.remove('recording');
  }
  
  const recordStatus = document.getElementById('recordStatusText');
  if (recordStatus) recordStatus.textContent = 'اضغط للبدء في التسجيل';
  
  const recordTimer = document.getElementById('recordTimer');
  if (recordTimer) {
    recordTimer.textContent = '00:00';
    recordTimer.classList.remove('recording');
  }
  
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) stopBtn.style.display = 'none';
}

function demoMode() {
  if (state.demoInterval) {
    clearInterval(state.demoInterval);
  }
  
  state.recording = true;
  const micBtn = document.getElementById('micBtn');
  micBtn.classList.add('recording');
  micBtn.textContent = '🔴';
  document.getElementById('recordStatusText').textContent = '● وضع العرض التجريبي (محاكاة)';
  document.getElementById('recordTimer').classList.add('recording');
  document.getElementById('stopBtn').style.display = 'inline-flex';
  document.getElementById('proceedBtn').style.display = 'none';
  startTimer();
  state.waveInterval = setInterval(animateWaves, 150);
  
  // Simulate live text with better pacing
  const demoTexts = [
    'مريض ذكر عمره 42 سنة يشكو من ألم في الحلق',
    ' وارتفاع في درجة الحرارة منذ يومين مع سعال جاف',
    ' وصعوبة في البلع، لا يوجد حساسية من الأدوية',
    '، لم يتناول أي علاج سابق.'
  ];
  
  let fullText = '';
  let index = 0;
  
  state.demoInterval = setInterval(() => {
    if (index < demoTexts.length) {
      fullText += demoTexts[index];
      document.getElementById('liveTranscript').innerHTML = 
        `<span style="color:var(--text)">${escapeHtml(fullText)}</span>`;
      state.transcript = fullText;
      index++;
    } else {
      clearInterval(state.demoInterval);
      state.demoInterval = null;
      // Auto-stop demo after completion
      setTimeout(() => {
        if (state.recording) {
          stopRecording();
        }
      }, 500);
    }
  }, 1000);
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ================== TIMER ==================
function startTimer() {
  if (state.timer) clearInterval(state.timer);
  state.seconds = 0;
  state.timer = setInterval(() => {
    state.seconds++;
    const m = String(Math.floor(state.seconds / 60)).padStart(2, '0');
    const s = String(state.seconds % 60).padStart(2, '0');
    const timerElement = document.getElementById('recordTimer');
    if (timerElement) {
      timerElement.textContent = `${m}:${s}`;
    }
  }, 1000);
}

// ================== STEP NAVIGATION ==================
function goToStep2() {
  if (!state.transcript || !state.transcript.trim()) {
    showToast('⚠️ يرجى تسجيل الحالة أولاً', 'error');
    return;
  }
  activateStep(2);
  document.getElementById('transcriptEdit').value = state.transcript.trim();
  
  // Detect language hint
  const hasArabic = /[\u0600-\u06FF]/.test(state.transcript);
  const detectedLangElement = document.getElementById('detectedLang');
  if (detectedLangElement) {
    detectedLangElement.textContent = hasArabic ? '🇸🇦 عربية' : '🌐 لغة لاتينية';
  }
}

function goToStep1() {
  activateStep(1);
}

function goToStep2Back() {
  activateStep(2);
}

function goToStep3() {
  activateStep(3);
  document.getElementById('prescriptionForm').style.display = 'block';
  document.getElementById('aiGenerating').style.display = 'none';
}

async function generatePrescription() {
  const text = document.getElementById('transcriptEdit').value.trim();
  if (!text) {
    showToast('⚠️ النص فارغ', 'error');
    return;
  }
  
  activateStep(3);
  document.getElementById('aiGenerating').style.display = 'block';
  document.getElementById('prescriptionForm').style.display = 'none';
  
  // Simulate AI processing
  setTimeout(() => {
    const demoData = getDemoData(text);
    fillPrescriptionForm(demoData);
  }, 1500);
}

function getDemoData(text) {
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  
  let age = 'غير محدد';
  const ageMatch = text.match(/(\d+)\s*سنة/);
  if (ageMatch) age = ageMatch[1] + ' سنة';
  
  let gender = 'غير محدد';
  if (text.includes('ذكر')) gender = 'ذكر';
  if (text.includes('أنثى') || text.includes('انثى')) gender = 'أنثى';
  
  return {
    patientName: 'غير محدد',
    patientAge: age,
    patientGender: gender,
    symptoms: ['ألم في الحلق', 'ارتفاع الحرارة', 'سعال جاف'],
    diagnoses: ['التهاب اللوزتين الحاد', 'التهاب البلعوم'],
    medications: [
      { name: 'أموكسيسيلين 500mg', dose: '1 كبسولة', frequency: '3 مرات يومياً', duration: '7 أيام', timing: 'بعد الأكل' },
      { name: 'باراسيتامول 500mg', dose: '2 حبة', frequency: 'كل 8 ساعات', duration: '3 أيام', timing: 'عند الحاجة' }
    ],
    advice: 'الراحة التامة في المنزل — الإكثار من السوائل الدافئة — تجنب الأطعمة الحارة',
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
  
  state.symptoms = data.symptoms || [];
  renderTags('symptomsTags', state.symptoms, 'symptoms');
  
  state.diagnoses = data.diagnoses || [];
  renderTags('diagnosisTags', state.diagnoses, 'diagnoses');
  
  state.medications = data.medications || [];
  renderMedications();
  
  showToast('✓ تم توليد المعاينة والوصفة بنجاح', 'success');
}

// ================== TAGS SYSTEM ==================
function setupTagsInput(inputId, tagsId, arr, type) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const val = input.value.trim();
      if (!arr.includes(val)) {
        arr.push(val);
        renderTags(tagsId, arr, type);
      }
      input.value = '';
    }
  });
}

function renderTags(containerId, arr, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = arr.map((tag, i) =>
    `<span class="diagnosis-tag">${escapeHtml(tag)} <span class="remove" onclick="removeTag('${type}', ${i})">×</span></span>`
  ).join('');
}

function removeTag(type, index) {
  if (type === 'symptoms') {
    state.symptoms.splice(index, 1);
    renderTags('symptomsTags', state.symptoms, 'symptoms');
  } else if (type === 'diagnoses') {
    state.diagnoses.splice(index, 1);
    renderTags('diagnosisTags', state.diagnoses, 'diagnoses');
  }
}

// ================== MEDICATIONS ==================
function renderMedications() {
  const list = document.getElementById('medicationsList');
  if (!list) return;
  
  if (state.medications.length === 0) {
    list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">لا توجد أدوية مضافة</p>';
    return;
  }
  
  list.innerHTML = state.medications.map((med, i) => `
    <div class="med-item">
      <div>
        <div class="med-name">💊 ${escapeHtml(med.name)}</div>
        <div class="med-detail">${escapeHtml(med.dose || 'جرعة غير محددة')} — ${escapeHtml(med.timing || 'بعد الأكل')}</div>
      </div>
      <div class="med-badge">${escapeHtml(med.frequency || 'مرة يومياً')}</div>
      <div class="med-duration">⏱️ ${escapeHtml(med.duration || 'غير محدد')}</div>
      <button class="med-remove" onclick="removeMed(${i})">🗑️</button>
    </div>
  `).join('');
}

function removeMed(i) {
  state.medications.splice(i, 1);
  renderMedications();
  showToast('✓ تم حذف الدواء', 'success');
}

function openAddMedModal() {
  const modal = document.getElementById('addMedModal');
  if (modal) modal.classList.add('open');
}

function closeAddMedModal() {
  const modal = document.getElementById('addMedModal');
  if (modal) modal.classList.remove('open');
  
  document.getElementById('medName').value = '';
  document.getElementById('medDose').value = '';
  document.getElementById('medDuration').value = '';
}

function addMedication() {
  const name = document.getElementById('medName').value.trim();
  if (!name) {
    showToast('⚠️ أدخل اسم الدواء', 'error');
    return;
  }
  
  state.medications.push({
    name: name,
    dose: document.getElementById('medDose').value || 'حسب التعليمات',
    frequency: document.getElementById('medFreq').value,
    duration: document.getElementById('medDuration').value || 'حسب التعليمات',
    timing: document.getElementById('medTiming').value
  });
  
  renderMedications();
  closeAddMedModal();
  showToast('✓ تم إضافة الدواء', 'success');
}

// ================== STEP 4: PRINT ==================
function goToStep4() {
  if (state.symptoms.length === 0 && state.diagnoses.length === 0 && state.medications.length === 0) {
    showToast('⚠️ يرجى إكمال بيانات الوصفة أولاً', 'error');
    return;
  }
  
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
  
  const diagTagsHTML = state.diagnoses.map(d => `<span class="print-diag-tag">${escapeHtml(d)}</span>`).join('');
  const sympTagsHTML = state.symptoms.map(s => `<span class="print-diag-tag" style="background:#fff8e1;border-color:#ffe082;color:#795548">${escapeHtml(s)}</span>`).join('');
  
  const medsHTML = state.medications.length > 0 ? `
    <table class="print-med-table">
      <thead><tr><th>اسم الدواء</th><th>الجرعة</th><th>التكرار</th><th>المدة</th><th>الملاحظات</th></tr></thead>
      <tbody>
        ${state.medications.map(m => `
          <tr>
            <td><strong>${escapeHtml(m.name)}</strong></td>
            <td>${escapeHtml(m.dose)}</td>
            <td>${escapeHtml(m.frequency)}</td>
            <td>${escapeHtml(m.duration)}</td>
            <td>${escapeHtml(m.timing)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<p style="color:#888;font-size:14px;text-align:center">لا توجد أدوية موصوفة</p>';
  
  const previewDiv = document.getElementById('printPreview');
  if (!previewDiv) return;
  
  previewDiv.innerHTML = `
    <div class="print-watermark">Rx</div>
    <div class="print-header">
      <div>
        <div class="print-clinic-name">⚕️ المساعد الطبي الذكي</div>
        <div class="print-doctor-info">Dr. AI Assistant — نظام المعاينات الطبية<br>تاريخ الإصدار: ${escapeHtml(date)}</div>
      </div>
      <div class="print-rx-symbol">Rx</div>
    </div>
    
    <div class="print-patient-row">
      <span>المريض: <strong>${escapeHtml(name)}</strong></span>
      ${age ? `<span>العمر: <strong>${escapeHtml(age)}</strong></span>` : ''}
      ${gender ? `<span>الجنس: <strong>${escapeHtml(gender)}</strong></span>` : ''}
      <span>التاريخ: <strong>${escapeHtml(date)}</strong></span>
    </div>
    
    ${sympTagsHTML ? `<div class="print-section-title">📋 الأعراض</div><div class="print-diagnosis-tags">${sympTagsHTML}</div>` : ''}
    
    <div class="print-section-title">🔍 التشخيص</div>
    <div class="print-diagnosis-tags">${diagTagsHTML || '<span style="color:#888">لم يحدد</span>'}</div>
    
    <div class="print-section-title">💊 الوصفة الطبية</div>
    ${medsHTML}
    
    ${advice ? `<div class="print-section-title">📝 التعليمات والنصائح</div>
    <p style="font-size:14px;line-height:1.8;color:#3a4555;padding:12px;background:#f7f9ff;border-radius:8px">${escapeHtml(advice).replace(/\n/g, '<br>')}</p>` : ''}
    
    ${followUp ? `<div class="print-section-title">📅 موعد المتابعة</div>
    <p style="font-size:14px;color:#3a4555;font-weight:600">📅 ${escapeHtml(followUp)}</p>` : ''}
    
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

function printPrescription() {
  window.print();
}

function startNew() {
  if (state.recognition) {
    try {
      state.recognition.abort();
    } catch(e) {}
  }
  if (state.demoInterval) {
    clearInterval(state.demoInterval);
  }
  if (state.timer) {
    clearInterval(state.timer);
  }
  if (state.waveInterval) {
    clearInterval(state.waveInterval);
  }
  
  state.transcript = '';
  state.medications = [];
  state.symptoms = [];
  state.diagnoses = [];
  state.seconds = 0;
  state.recording = false;
  state.isRestarting = false;
  
  resetRecordingUI();
  
  const liveTranscript = document.getElementById('liveTranscript');
  if (liveTranscript) {
    liveTranscript.innerHTML = '<span class="transcript-placeholder">سيظهر النص هنا أثناء التسجيل...</span>';
  }
  
  const proceedBtn = document.getElementById('proceedBtn');
  if (proceedBtn) proceedBtn.style.display = 'none';
  
  const formFields = ['patientName', 'patientAge', 'adviceText', 'followUp'];
  formFields.forEach(field => {
    const el = document.getElementById(field);
    if (el) el.value = '';
  });
  
  const genderSelect = document.getElementById('patientGender');
  if (genderSelect) genderSelect.value = '';
  
  const dateInput = document.getElementById('prescDate');
  if (dateInput) dateInput.valueAsDate = new Date();
  
  const symptomsTags = document.getElementById('symptomsTags');
  if (symptomsTags) symptomsTags.innerHTML = '';
  
  const diagnosisTags = document.getElementById('diagnosisTags');
  if (diagnosisTags) diagnosisTags.innerHTML = '';
  
  const medsList = document.getElementById('medicationsList');
  if (medsList) medsList.innerHTML = '';
  
  buildWaves();
  activateStep(1);
  showToast('✓ جاهز لحالة جديدة', 'success');
}

// ================== STEP ACTIVATION ==================
function activateStep(n) {
  const icons = { 1: '🎙️', 2: '📝', 3: '🤖', 4: '🖨️' };
  
  for (let i = 1; i <= 4; i++) {
    const panel = document.getElementById('panel' + i);
    const step = document.getElementById('step' + i);
    const circle = step?.querySelector('.step-circle');
    
    if (panel) panel.classList.toggle('active', i === n);
    if (step) step.classList.toggle('active', i === n);
    if (step) step.classList.toggle('done', i < n);
    if (circle) {
      circle.classList.toggle('active', i === n);
      circle.classList.toggle('done', i < n);
      if (i < n) {
        circle.textContent = '✓';
      } else {
        circle.textContent = icons[i] || '●';
      }
    }
  }
  
  for (let i = 1; i <= 3; i++) {
    const conn = document.getElementById('conn' + i);
    if (conn) conn.classList.toggle('active', i < n);
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================== TOAST ==================
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  
  t.textContent = msg;
  t.className = 'toast show';
  if (type === 'success') t.classList.add('success');
  if (type === 'error') t.classList.add('error');
  if (type === 'info') t.classList.add('info');
  
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => {
      t.className = 'toast';
    }, 300);
  }, 3000);
}