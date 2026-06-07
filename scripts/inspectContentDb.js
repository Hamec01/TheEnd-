const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../apps/backend/data/theend_content.local.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const content = data.content;
const trainers = content.npcs.filter(n => n.professionTrainer || n.canTrain || (n.dialogues && JSON.stringify(n.dialogues).includes('profession')));
console.log('Trainers count:', trainers.length);
trainers.forEach(t => {
  console.log(`Trainer ID: ${t.id}, Name: ${t.name}`);
  console.log(JSON.stringify(t, null, 2));
  if (t.dialogues) {
    t.dialogues.forEach(d => {
      const dialogueObj = content.dialogues.find(x => x.id === d.dialogueId);
      if (dialogueObj) {
        console.log(`Dialogue ${d.dialogueId}:`, JSON.stringify(dialogueObj, null, 2));
      }
    });
  }
});
