document.addEventListener('DOMContentLoaded', function() {
  // Elementy
  const fileInput = document.getElementById('fileInput');
  const fileList = document.getElementById('fileList');
  const convertBtn = document.getElementById('convertBtn');
  const resetBtn = document.getElementById('resetBtn');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const downloadLinks = document.getElementById('downloadLinks');
  
  let selectedFiles = [];
  
  // Detekce mobilního zařízení
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Event listenery
  fileInput.addEventListener('change', handleFileSelection);
  convertBtn.addEventListener('click', startConversion);
  resetBtn.addEventListener('click', resetConverter);
  
  function handleFileSelection(e) {
    const files = Array.from(e.target.files);
    
    // Filtrování podporovaných formátů
    const validFiles = files.filter(file => {
      const validTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
        'image/bmp', 'image/tiff', 'image/webp'
      ];
      const validExtensions = ['.svg'];
      
      return validTypes.includes(file.type.toLowerCase()) || 
             validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    });
    
    if (validFiles.length === 0) {
      alert('Vyberte prosím platné obrázkové soubory (JPG, PNG, GIF, BMP, TIFF, WebP, SVG)');
      return;
    }
    
    // Přidání nových souborů
    validFiles.forEach(file => {
      if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
        selectedFiles.push(file);
      }
    });
    
    updateFileList();
    updateConvertButton();
  }
  
  function updateFileList() {
    fileList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      
      const fileIcon = getFileIcon(file);
      
      fileItem.innerHTML = `
        <div class="file-info">
          <span class="file-icon">${fileIcon}</span>
          <span class="file-name">${file.name}</span>
        </div>
        <button class="remove-btn" data-index="${index}">Odstranit</button>
      `;
      
      const removeBtn = fileItem.querySelector('.remove-btn');
      removeBtn.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        removeFile(index);
      });
      
      fileList.appendChild(fileItem);
    });
  }
  
  function getFileIcon(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const iconMap = {
      'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
      'bmp': '🖼️', 'tiff': '🖼️', 'webp': '🖼️', 'svg': '🎨'
    };
    return iconMap[extension] || '📄';
  }
  
  function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    updateConvertButton();
  }
  
  function updateConvertButton() {
    convertBtn.disabled = selectedFiles.length === 0;
  }
  
  async function startConversion() {
    if (selectedFiles.length === 0) {
      alert('Vyberte alespoň jeden obrázek');
      return;
    }
    
    showStep(2);
    downloadLinks.innerHTML = '';
    
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const progress = Math.round((i / selectedFiles.length) * 100);
        
        updateProgress(progress, `Převádím: ${file.name}`);
        
        const pdfBlob = await convertImageToPdf(file);
        createDownloadLink(pdfBlob, file.name);
      }
      
      updateProgress(100, 'Převod dokončen');
      showStep(3);
      
    } catch (error) {
      console.error('Chyba při převodu:', error);
      alert('Nastala chyba při převodu: ' + error.message);
      showStep(1);
    }
  }
  
  // Hlavní konverzní funkce s mobilní optimalizací
  async function convertImageToPdf(file) {
    return new Promise((resolve, reject) => {
      try {
        if (file.name.toLowerCase().endsWith('.svg')) {
          convertSvgToPdf(file).then(resolve).catch(reject);
        } else {
          convertRegularImageToPdf(file).then(resolve).catch(reject);
        }
      } catch (error) {
        reject(new Error(`Chyba při převodu ${file.name}: ${error.message}`));
      }
    });
  }
  
  async function convertRegularImageToPdf(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const img = new Image();
        
        img.onload = function() {
          try {
            // Vytvoření canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Nastavení rozměrů
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            
            // Vykreslení obrázku
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Vytvoření PDF
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
              orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
              unit: 'px',
              format: [canvas.width, canvas.height],
              compress: false
            });
            
            const imgData = canvas.toDataURL('image/png', 1.0);
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            
            // Mobilní kompatibilita - použití blob místo přímého stahování
            resolve(pdf.output('blob'));
          } catch (error) {
            reject(new Error('Chyba při vytváření PDF: ' + error.message));
          }
        };
        
        img.onerror = () => reject(new Error('Nelze načíst obrázek'));
        img.crossOrigin = 'anonymous';
        img.src = e.target.result;
      };
      
      reader.onerror = () => reject(new Error('Nelze načíst soubor'));
      reader.readAsDataURL(file);
    });
  }
  
  async function convertSvgToPdf(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        try {
          const svgContent = e.target.result;
          const img = new Image();
          
          img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.width || 800;
            canvas.height = img.height || 600;
            
            // Bílé pozadí pro SVG
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
              orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
              unit: 'px',
              format: [canvas.width, canvas.height]
            });
            
            const imgData = canvas.toDataURL('image/png', 1.0);
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            
            resolve(pdf.output('blob'));
          };
          
          img.onerror = () => reject(new Error('Chyba při převodu SVG'));
          
          const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          img.src = url;
        } catch (error) {
          reject(new Error('Chyba při zpracování SVG: ' + error.message));
        }
      };
      
      reader.readAsText(file);
    });
  }
  
  function createDownloadLink(blob, originalName) {
    const fileName = originalName.replace(/\.[^/.]+$/, '.pdf');
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.className = 'download-link';
    link.innerHTML = `📄 ${fileName}`;
    
    // Mobilní kompatibilita pro stahování
    if (isMobile) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        window.open(url, '_blank');
        
        // Zobrazit instrukce pro mobilní uživatele
        const notice = document.createElement('div');
        notice.className = 'mobile-notice';
        notice.innerHTML = 'PDF otevřeno v novém okně. Použijte menu prohlížeče pro uložení nebo sdílení.';
        this.parentNode.insertBefore(notice, this.nextSibling);
        
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      });
    } else {
      link.addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(url), 1000));
    }
    
    downloadLinks.appendChild(link);
  }
  
  function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
  }
  
  function showStep(stepNumber) {
    document.querySelectorAll('.step').forEach((step, i) => {
      step.classList.toggle('active', i === stepNumber - 1);
    });
  }
  
  function resetConverter() {
    selectedFiles = [];
    fileInput.value = '';
    updateFileList();
    updateConvertButton();
    downloadLinks.innerHTML = '';
    progressFill.style.width = '0%';
    showStep(1);
  }
});
