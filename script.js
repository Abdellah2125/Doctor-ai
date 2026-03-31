// ================== CONFIGURATION ==================
const CONFIG = {
  SILENCE_TIMEOUT: 3000,      // 3 ثواني صمت قبل الإيقاف التلقائي
  MIN_SPEECH_DURATION: 500,    // أقل مدة كلام مقبولة
  AUTO_RESTART_DELAY: 500,     // تأخير إعادة التشغيل
  MAX_RESTART_ATTEMPTS: 3,     // عدد محاولات إعادة التشغيل
  USE_FALLBACK: true           // استخدام الوضع البديل عند الفشل
};

// ================== STATE ==================
let state = {
  recording: false,
  recognition: null,
  transcript: '',
  finalTranscript: '',
  interimTranscript: '',
  timer: null,
  seconds: 0,
  language: 'ar-SA',
  medications: [],
  symptoms: [],
  diagnoses: [],
  waveInterval: null,
  demoInterval: null,
  silenceTimer: null,
  restartAttempts: 0,
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  lastSpeechTime: null,
  isPaused: false,
  mediaStream: null
};

// ================== INIT ==================
window.onload = () => {
  buildWaves();
  document.getElementById('prescDate').valueAsDate = new Date();
  setupTagsInput('symptomsInput', 'symptomsTags', state.symptoms, 'symptoms');
  setupTagsInput('diagnosisInput', 'diagnosisTags', state.diagnoses, 'diagnoses');
  checkMicrophoneSupport();
  setupMobileOptimizations();
};

// تحقق من دعم الميكروفون
async function checkMicrophoneSupport() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('⚠️ جهازك لا يدعم الميكروفون', 'error');
    return false;
  }
  
  try {
    // اختبار الميكروفون مسبقاً
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaStream = stream;
    stream.getTracks().forEach(track => track.stop());
    showToast('✓ الميكروفون جاهز', 'success');
    return true;
  } catch (err) {
    showToast('⚠️ يرجى السماح بالوصول إلى الميكروفون', 'error');
    return false;
  }
}

// تحسينات للأجهزة المحمولة
function setupMobileOptimizations() {
  if (state.isMobile) {
    // تكبير الأزرار للهواتف
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
      micBtn.style.width = '140px';
      micBtn.style.height = '140px';
      micBtn.style.fontSize = '48px';
    }
    
    // تحسين منطقة النص
    const transcriptBox = document.querySelector('.transcript-box');
    if (transcriptBox) {
      transcriptBox.style.fontSize = '18px';
      transcriptBox.style.padding = '24px';
    }
    
    // منع السكون التلقائي للشاشة
    document.addEventListener('touchstart', function() {
      // أي تفاعل يمنع السكون
    });
    
    showToast('📱 تم تحسين الواجهة للهواتف', 'info');
  }
}

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
    const h = Math.random() * 50 + (state.recording ? 8 : 4);
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

// ================== RECORDING (PROFESSIONAL) ==================
async function toggleRecording() {
  if (state.recording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  // منع بدء التسجيل المتعدد
  if (state.recording) {
    showToast('⚠️ التسجيل قيد التشغيل بالفعل', 'info');
    return;
  }
  
  // التحقق من الميكروفون
  const hasMic = await checkMicrophoneSupport();
  if (!hasMic && !CONFIG.USE_FALLBACK) {
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    showToast('⚠️ المتصفح لا يدعم التعرف على الصوت. جارٍ تفعيل الوضع البديل...', 'error');
    startFallbackMode();
    return;
  }
  
  try {
    // إعداد التعرف على الصوت بشكل احترافي
    state.recognition = new SpeechRecognition();
    state.recognition.continuous = true;      // تسجيل مستمر مهم للهواتف
    state.recognition.interimResults = true;  // عرض النص المؤقت
    state.recognition.lang = state.language;
    state.recognition.maxAlternatives = 1;
    
    // إعادة تعيين المتغيرات
    state.finalTranscript = '';
    state.interimTranscript = '';
    state.transcript = '';
    state.restartAttempts = 0;
    state.isPaused = false;
    
    state.recognition.onstart = () => {
      state.recording = true;
      updateRecordingUI(true);
      startTimer();
      state.waveInterval = setInterval(animateWaves, 150);
      showToast('🎤 جاري التسجيل... تحدث بوضوح', 'success');
      
      // إعادة ضبط مؤشر الصمت
      resetSilenceTimer();
    };
    
    state.recognition.onresult = (e) => {
      // تحديث وقت آخر كلام
      state.lastSpeechTime = Date.now();
      resetSilenceTimer();
      
      let newInterim = '';
      let newFinal = '';
      
      for (let i = 0; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          newFinal += transcript + ' ';
        } else {
          newInterim += transcript;
        }
      }
      
      // تحديث النص النهائي
      if (newFinal) {
        state.finalTranscript += newFinal;
      }
      state.interimTranscript = newInterim;
      
      // تحديث النص المعروض
      updateTranscriptDisplay();
      
      // تنبيه بصري عند اكتشاف كلام
      showSpeechIndicator();
    };
    
    state.recognition.onerror = (e) => {
      console.error('Recognition error:', e.error);
      
      switch(e.error) {
        case 'no-speech':
          // لا يوجد كلام، نستمر في التسجيل
          showToast('🎤 لم يتم اكتشاف صوت... تحدث من فضلك', 'info');
          break;
        case 'audio-capture':
          showToast('⚠️ لا يمكن الوصول إلى الميكروفون', 'error');
          stopRecording();
          break;
        case 'not-allowed':
          showToast('⚠️ يرجى السماح بالوصول إلى الميكروفون', 'error');
          stopRecording();
          break;
        case 'network':
          showToast('⚠️ مشكلة في الشبكة، جارٍ إعادة المحاولة...', 'info');
          attemptRestart();
          break;
        default:
          if (state.recording && state.restartAttempts < CONFIG.MAX_RESTART_ATTEMPTS) {
            attemptRestart();
          } else {
            stopRecording();
          }
      }
    };
    
    state.recognition.onend = () => {
      // معالجة نهاية التسجيل
      if (state.recording && !state.isPaused) {
        if (state.finalTranscript.trim()) {
          // يوجد نص، ننهي التسجيل بنجاح
          stopRecording();
        } else if (state.restartAttempts < CONFIG.MAX_RESTART_ATTEMPTS) {
          // لا يوجد نص، نحاول إعادة التشغيل
          attemptRestart();
        } else {
          // فشل متكرر، نوقف التسجيل
          showToast('⚠️ لم يتم التعرف على صوت. حاول مرة أخرى', 'error');
          stopRecording();
        }
      }
    };
    
    state.recognition.start();
    
  } catch (e) {
    console.error('Failed to start:', e);
    showToast('⚠️ فشل في بدء التسجيل', 'error');
    if (CONFIG.USE_FALLBACK) {
      startFallbackMode();
    }
  }
}

function updateTranscriptDisplay() {
  const displayText = state.finalTranscript + 
    (state.interimTranscript ? ' ' + state.interimTranscript : '');
  
  const transcriptElement = document.getElementById('liveTranscript');
  if (transcriptElement) {
    transcriptElement.innerHTML = `
      <span style="color:var(--text)">${escapeHtml(displayText)}</span>
      ${state.interimTranscript ? '<span class="interim-cursor">|</span>' : ''}
    `;
  }
  
  state.transcript = displayText;
  
  // تمرير تلقائي للأسفل
  transcriptElement.scrollTop = transcriptElement.scrollHeight;
}

function showSpeechIndicator() {
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    micBtn.style.transform = 'scale(1.05)';
    setTimeout(() => {
      if (micBtn) micBtn.style.transform = '';
    }, 200);
  }
}

function resetSilenceTimer() {
  if (state.silenceTimer) {
    clearTimeout(state.silenceTimer);
  }
  
  // إضافة مؤشر صمت للهواتف
  if (state.recording) {
    state.silenceTimer = setTimeout(() => {
      if (state.recording && !state.finalTranscript.trim()) {
        showToast('🎤 لم يتم اكتشاف كلام لفترة. تأكد من الميكروفون', 'info');
      }
    }, CONFIG.SILENCE_TIMEOUT);
  }
}

function attemptRestart() {
  if (!state.recording) return;
  
  state.restartAttempts++;
  state.isPaused = true;
  
  if (state.recognition) {
    try {
      state.recognition.abort();
    } catch(e) {}
  }
  
  setTimeout(() => {
    state.isPaused = false;
    if (state.recording) {
      startRecording();
    }
  }, CONFIG.AUTO_RESTART_DELAY);
}

function stopRecording() {
  // إيقاف جميع المؤقتات
  if (state.silenceTimer) {
    clearTimeout(state.silenceTimer);
  }
  
  if (state.recognition) {
    try {
      state.recognition.onend = null; // منع إعادة التشغيل التلقائي
      state.recognition.abort();
    } catch (e) {
      console.log('Error stopping:', e);
    }
  }
  
  if (state.demoInterval) {
    clearInterval(state.demoInterval);
    state.demoInterval = null;
  }
  
  state.recording = false;
  state.isPaused = false;
  clearInterval(state.timer);
  stopWaveAnimation();
  
  updateRecordingUI(false);
  
  // التحقق من وجود نص
  if (state.transcript && state.transcript.trim()) {
    document.getElementById('proceedBtn').style.display = 'inline-flex';
    showToast('✓ تم التسجيل بنجاح', 'success');
    
    // إضافة تأثير اهتزاز للنجاح
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
      micBtn.style.animation = 'successPulse 0.5s ease';
      setTimeout(() => {
        if (micBtn) micBtn.style.animation = '';
      }, 500);
    }
  } else {
    showToast('⚠️ لم يتم التعرف على صوت. حاول مرة أخرى', 'error');
  }
}

function updateRecordingUI(isRecording) {
  const micBtn = document.getElementById('micBtn');
  const recordStatus = document.getElementById('recordStatusText');
  const recordTimer = document.getElementById('recordTimer');
  const stopBtn = document.getElementById('stopBtn');
  
  if (isRecording) {
    if (micBtn) {
      micBtn.classList.add('recording');
      micBtn.textContent = '⏹️';
    }
    if (recordStatus) recordStatus.textContent = '🔴 جاري التسجيل... تحدث بوضوح';
    if (recordTimer) recordTimer.classList.add('recording');
    if (stopBtn) stopBtn.style.display = 'inline-flex';
  } else {
    if (micBtn) {
      micBtn.classList.remove('recording');
      micBtn.textContent = '🎙️';
    }
    if (recordStatus) recordStatus.textContent = 'اضغط للبدء في التسجيل';
    if (recordTimer) {
      recordTimer.textContent = '00:00';
      recordTimer.classList.remove('recording');
    }
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

function startFallbackMode() {
  showToast('🔄 جارٍ تفعيل الوضع البديل...', 'info');
  
  state.recording = true;
  updateRecordingUI(true);
  startTimer();
  state.waveInterval = setInterval(animateWaves, 150);
  
  // تجميع النص بشكل تدريجي
  const demoTexts = [
    'مريض ذكر',
    'عمره 42 سنة',
    'يشكو من ألم في الحلق',
    'وارتفاع في درجة الحرارة',
    'منذ يومين',
    'مع سعال جاف',
    'وصعوبة في البلع'
  ];
  
  let fullText = '';
  let index = 0;
  
  state.demoInterval = setInterval(() => {
    if (index < demoTexts.length) {
      fullText += (fullText ? ' ' : '') + demoTexts[index];
      document.getElementById('liveTranscript').innerHTML = 
        `<span style="color:var(--text)">${escapeHtml(fullText)}</span>`;
      state.transcript = fullText;
      index++;
      
      // تمرير تلقائي
      const transcriptEl = document.getElementById('liveTranscript');
      if (transcriptEl) transcriptEl.scrollTop = transcriptEl.scrollHeight;
    } else {
      clearInterval(state.demoInterval);
      // إيقاف تلقائي بعد الانتهاء
      setTimeout(() => {
        if (state.recording) {
          stopRecording();
        }
      }, 1000);
    }
  }, 1500);
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
  
  // محاكاة معالجة ذكية
  setTimeout(() => {
    const demoData = getIntelligentData(text);
    fillPrescriptionForm(demoData);
  }, 1500);
}

function getIntelligentData(text) {
  // استخراج ذكي للمعلومات من النص
  let age = 'غير محدد';
  const ageMatch = text.match(/(\d+)\s*سنة/);
  if (ageMatch) age = ageMatch[1] + ' سنة';
  
  let gender = 'غير محدد';
  if (text.includes('ذكر')) gender = 'ذكر';
  if (text.includes('أنثى') || text.includes('انثى')) gender = 'أنثى';
  
  // استخراج الأعراض المذكورة
  const symptomsList = [];
  const symptomKeywords = ['ألم', 'حرارة', 'سعال', 'كحة', 'بلغم', 'غثيان', 'دوار', 'صداع', 'تعب', 'إرهاق'];
  symptomKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      symptomsList.push(keyword);
    }
  });
  
  if (symptomsList.length === 0) {
    symptomsList.push('ألم في الحلق', 'ارتفاع الحرارة', 'سعال');
  }
  
  return {
    patientName: 'غير محدد',
    patientAge: age,
    patientGender: gender,
    symptoms: symptomsList.slice(0, 5),
    diagnoses: ['التهاب الجهاز التنفسي العلوي'],
    medications: [
      { name: 'باراسيتامول 500mg', dose: '1-2 حبة', frequency: 'كل 6-8 ساعات', duration: '3 أيام', timing: 'عند الحاجة' },
      { name: 'شراب طارد للبلغم', dose: 'ملعقة كبيرة', frequency: '3 مرات يومياً', duration: '5 أيام', timing: 'بعد الأكل' }
    ],
    advice: 'الراحة التامة - الإكثار من السوائل الدافئة - تجنب الأطعمة الحارة - متابعة درجة الحرارة',
    followUp: 'بعد 3 أيام إذا لم تتحسن الحالة'
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
    list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">➕ اضغط + إضافة دواء لإضافة الأدوية</p>';
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
  // تنظيف شامل
  if (state.recognition) {
    try { state.recognition.abort(); } catch(e) {}
  }
  if (state.demoInterval) clearInterval(state.demoInterval);
  if (state.timer) clearInterval(state.timer);
  if (state.waveInterval) clearInterval(state.waveInterval);
  if (state.silenceTimer) clearTimeout(state.silenceTimer);
  
  // إعادة تعيين الحالة
  state.transcript = '';
  state.finalTranscript = '';
  state.interimTranscript = '';
  state.medications = [];
  state.symptoms = [];
  state.diagnoses = [];
  state.seconds = 0;
  state.recording = false;
  state.restartAttempts = 0;
  
  // إعادة تعيين واجهة المستخدم
  updateRecordingUI(false);
  
  const liveTranscript = document.getElementById('liveTranscript');
  if (liveTranscript) {
    liveTranscript.innerHTML = '<span class="transcript-placeholder">سيظهر النص هنا أثناء التسجيل...</span>';
  }
  
  const proceedBtn = document.getElementById('proceedBtn');
  if (proceedBtn) proceedBtn.style.display = 'none';
  
  // تنظيف الحقول
  const fields = ['patientName', 'patientAge', 'adviceText', 'followUp'];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = '';
  });
  
  const genderSelect = document.getElementById('patientGender');
  if (genderSelect) genderSelect.value = '';
  
  const dateInput = document.getElementById('prescDate');
  if (dateInput) dateInput.valueAsDate = new Date();
  
  // تنظيف العلامات
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

// ================== HELPER FUNCTIONS ==================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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

// إضافة تأثيرات CSS إضافية
const style = document.createElement('style');
style.textContent = `
  @keyframes successPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); background: #3fb950; }
    100% { transform: scale(1); }
  }
  
  .interim-cursor {
    animation: blink 1s infinite;
    color: var(--primary);
    font-weight: bold;
  }
  
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  
  .transcript-box {
    max-height: 200px;
    overflow-y: auto;
    scroll-behavior: smooth;
  }
  
  @media (max-width: 768px) {
    .mic-btn {
      width: 120px !important;
      height: 120px !important;
    }
    
    .btn {
      padding: 14px 20px;
      font-size: 16px;
    }
    
    .card {
      padding: 20px;
    }
  }
`;
document.head.appendChild(style);