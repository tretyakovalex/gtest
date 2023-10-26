const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// create images folder if it doesn't exist
if (!fs.existsSync(path.join(__dirname,'../public/assets/images'))) {
  fs.mkdirSync(path.join(__dirname,'../public/assets/images'));
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname,'../public/assets/images'));
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    }
  });
  
const upload = multer({ storage: storage });

router.post('/api/upload', upload.array('image', 27), (req, res) => {
    console.log('Received ' + req.files.length + ' files');
    res.status(200).json({message: 'Images Successfully Uploaded!'});
});

router.get('/api/images', (req, res) => {
  const images = ["assets/images/23.PNG", "assets/images/24.PNG", "assets/images/25.PNG", "assets/images/26.PNG", "assets/images/27.PNG"];
  const existingImages = [];
  for(let i = 0; i < images.length; i++){
    if(fs.existsSync(path.join(__dirname, '../public/', images[i]))){
      existingImages.push(images[i]);
    }
  } 

  res.status(200).json({images: existingImages});
});

module.exports = router;
