import fs from 'fs';

const path = 'src/app/api/me/choice/route.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /\/\/ Upsert choice[\s\S]*?create: \{ teamId, eventId, option \},\s*\}\);/;

const replacement = `    // Ensure no existing choice
    const existingChoice = await prisma.choice.findUnique({
      where: { teamId_eventId: { teamId, eventId } },
    });
    if (existingChoice) {
      throw new Error('Your choice for this event is already locked in.');
    }

    // Create choice
    await prisma.choice.create({
      data: { teamId, eventId, option },
    });`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
