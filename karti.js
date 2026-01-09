// Current image file ID for download
let currentFileId = '';

// Open modal with image
function openModal(fileId, caption) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const modalCaption = document.getElementById('modalCaption');

    currentFileId = fileId;

    // Use Google Drive direct image URL
    modalImg.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
    modalImg.style.display = 'block';
    modalCaption.textContent = caption;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

// Close modal
function closeModal() {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.style.display = 'none';
    modalImg.style.display = 'none';
    modalImg.src = ''; // Clear the image source
    document.body.style.overflow = 'auto'; // Restore scrolling
}

// View in Google Drive
function viewInDrive() {
    if (currentFileId) {
        const driveUrl = `https://drive.google.com/file/d/${currentFileId}/view`;
        window.open(driveUrl, '_blank');
    }
}

// Download image
function downloadImage() {
    if (currentFileId) {
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${currentFileId}`;
        window.open(downloadUrl, '_blank');
    }
}

// Close modal on Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});
