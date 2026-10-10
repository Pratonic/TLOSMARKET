import fs from 'fs';

let content = fs.readFileSync('src/app/api/me/state/route.ts', 'utf-8');

if (!content.includes('catch (e: any)')) {
  content = content.replace(/return response;\r?\n\}/, 'return response;\n  } catch (e: any) {\n    console.error(e);\n    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });\n  }\n}');
  fs.writeFileSync('src/app/api/me/state/route.ts', content);
}
