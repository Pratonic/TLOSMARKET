const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('C:\\Users\\Pratyush\\Downloads\\TLOS_Evaluation_System.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
});
