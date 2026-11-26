import asyncio, json, subprocess, sys, os, urllib.parse
from playwright.async_api import async_playwright
D='/home/claude/notsofast/brand'
qs=json.loads(subprocess.check_output(['node','-e',"const E=require('/home/claude/notsofast/src/engine.js');const o={};for(let d=11;d<=18;d++)o[d]=E.buildDaily(d)[0].q;console.log(JSON.stringify(o))"]))
only=sys.argv[1:] 
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); p=await b.new_page(viewport={'width':1080,'height':1920})
        for d,q in qs.items():
            if only and d not in only: continue
            for s in ('1','2','3'):
                await p.goto('file://%s/card.html?%s' % (D, urllib.parse.urlencode({'s':s,'q':q,'no':d})))
                await p.wait_for_timeout(250)
                await p.screenshot(path='%s/video/d%s_s%s.png' % (D,d,s))
        await b.close()
asyncio.run(main())
