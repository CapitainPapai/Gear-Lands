"""Original Gear Lands score. Acoustic-style physical/additive synthesis, stereo.
No chiptune waveforms, external samples, or copyrighted melodies.
Run: python scripts/synthesize_audio.py (numpy, scipy, soundfile).
"""
from pathlib import Path
import json, math
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
SR = 32000
TAU = 2 * np.pi
rng = np.random.default_rng(1887)

def freq(midi): return 440 * 2 ** ((midi - 69) / 12)
def seconds(s): return np.arange(int(s * SR), dtype=np.float64) / SR
def filter_noise(n, low, high=None):
    x = rng.normal(0, 1, n)
    if high: x = sosfilt(butter(2, [low, high], btype='bandpass', fs=SR, output='sos'), x)
    else: x = sosfilt(butter(2, low, btype='lowpass', fs=SR, output='sos'), x)
    return x / (np.std(x) + 1e-8)
def envelope(t, attack=.01, release=.15, sustain=.7):
    dur = len(t)/SR
    return np.minimum(1, t/max(.001,attack)) * np.minimum(1, np.maximum(0,(dur-t)/max(.001,release))) * (sustain + (1-sustain)*np.exp(-t*2))

def instrument(midi, duration, kind='piano', velocity=.7):
    t = seconds(duration)
    f = freq(midi)
    phase = TAU*f*t
    if kind == 'piano':
        x = np.zeros_like(t)
        for h, a in enumerate([1,.43,.22,.115,.065,.035,.018], 1):
            detune = math.sqrt(1 + .00013*h*h)
            x += a*np.sin(phase*h*detune)*np.exp(-t*(.85+h*.34+f/3200))
            x += .23*a*np.sin(phase*h*detune*1.0015 + .2)*np.exp(-t*(1.1+h*.3))
        x += filter_noise(len(t), 900, 3800)*.026*np.exp(-t*65)
        env = (1-np.exp(-t*240))*np.minimum(1,(duration-t)/.18)
    elif kind in ('strings','bow'):
        x = np.zeros_like(t)
        vibrato = .0025*np.sin(TAU*4.7*t) * np.minimum(1,t/.6)
        for h in range(1, 13):
            x += np.sin(phase*h + vibrato*phase + .12*h)*((1/h)**1.45)*np.exp(-t*.12*h)
        x += .12*np.sin(phase*1.003)*np.minimum(1,t/.2)
        env = envelope(t,.38 if kind=='strings' else .18,.35,.86)
    elif kind == 'flute':
        vibrato = .003*np.sin(TAU*5.1*t)*np.minimum(1,t/.3)
        x = np.sin(phase+vibrato*phase) + .14*np.sin(phase*2) + .045*np.sin(phase*3)
        x += .027*filter_noise(len(t), 700, 3500)
        env = envelope(t,.11,.2,.9)
    elif kind in ('bell','celesta'):
        x = np.sin(phase)*np.exp(-t*1.7)
        x += .34*np.sin(phase*2.756)*np.exp(-t*3.8)
        x += .12*np.sin(phase*5.404)*np.exp(-t*6.5)
        x += .15*np.sin(phase*2.002)*np.exp(-t*2)
        env = (1-np.exp(-t*320))*np.minimum(1,(duration-t)/.12)
    elif kind == 'brass':
        x = np.zeros_like(t)
        brightness = .5+.5*(1-np.exp(-t*5))
        for h in range(1,10): x += np.sin(phase*h + .003*np.sin(TAU*4.4*t)*phase) * (brightness**h)/h**1.2
        env = envelope(t,.09,.16,.75)
    elif kind == 'pluck':
        x = np.zeros_like(t)
        for h,a in enumerate([1,.56,.32,.2,.12,.07,.03],1): x += a*np.sin(phase*h*1.0005**h)*np.exp(-t*(1.4+h*.75))
        x += .018*filter_noise(len(t),500,2400)*np.exp(-t*35)
        env = (1-np.exp(-t*300))*np.minimum(1,(duration-t)/.1)
    elif kind == 'bass':
        x = np.sin(phase)+.23*np.sin(phase*2)+.07*np.sin(phase*3)
        env = (1-np.exp(-t*45))*np.exp(-t*1.4)*np.minimum(1,(duration-t)/.12)
    else:
        x = np.sin(phase)
        env = envelope(t,.2,.3)
    return np.asarray(x*env*velocity, dtype=np.float64)

def add(buf, sound, at, pan=0, dry=1):
    start = int(at*SR)
    n = len(sound)
    if n == 0: return
    idx = (start + np.arange(n)) % len(buf)
    gain_l = math.sqrt((1-pan)/2)*dry
    gain_r = math.sqrt((1+pan)/2)*dry
    buf[idx,0] += sound*gain_l
    buf[idx,1] += sound*gain_r

def drum(kind='tom', velocity=.5):
    dur = .7 if kind=='tom' else .35
    t=seconds(dur)
    if kind=='tom':
        phase=TAU*(48*t+45*.065*(1-np.exp(-t/.065)))
        return (np.sin(phase)*np.exp(-t*7)+.12*filter_noise(len(t),180,1300)*np.exp(-t*35))*velocity
    if kind=='metal':
        x=sum(np.sin(TAU*f*t)*np.exp(-t*d) for f,d in [(173,13),(291,17),(467,21)])
        return x*np.minimum(1,t*600)*velocity*.35
    return filter_noise(len(t),180,1600)*np.exp(-t*24)*velocity

def room(buf, amount=.2):
    original=buf.copy()
    for delay,gain in [(0.071,.32),(.137,.24),(.223,.18),(.347,.13),(.509,.09),(.733,.065),(.997,.04)]:
        d=int(delay*SR)
        buf[d:,0]+=original[:-d,1]*gain*amount
        buf[d:,1]+=original[:-d,0]*gain*amount
        buf[:d,0]+=original[-d:,1]*gain*amount
        buf[:d,1]+=original[-d:,0]*gain*amount
    return buf

def ambience(buf, character, intensity):
    t=np.arange(len(buf))/SR
    dur=len(buf)/SR
    # Periodic modulation and circular filtered noise make the loop seam quiet.
    wind=filter_noise(len(t),180,1400)
    wind=np.roll(wind,int(.13*SR))*.65+wind*.35
    mod=.5+.2*np.sin(TAU*t/dur*3)+.15*np.sin(TAU*t/dur*7+.5)
    level=.011 if character!='battle' else .006
    buf[:,0]+=wind*mod*level
    buf[:,1]+=np.roll(wind,271)*mod*level
    if character in ('industrial','battle'):
        for i in range(int(dur/3.7)):
            add(buf,drum('tom',.09),i*3.7+.13,-.3)
        for i in range(int(dur/7)):
            t2=seconds(1.8)
            steam=filter_noise(len(t2),900,4200)*np.sin(np.pi*t2/1.8)**2*.014
            add(buf,steam,i*7+2.1,.5)

# Explicit, original motifs. None is drawn from an existing composition.
TRACKS=[
 dict(name='Пробуждение',key=50,scale='minor',bpm=58,bars=16,lead='flute',chords=[0,5,3,4],motif=[0,-1,2,4,-1,3,2,-1,0,-1,4,6,4,2,-1,-1],mood='ambient',character='ruins',description='Дыхание ветра среди остывших механизмов. Флейта, мягкие струнные и далёкий металл.'),
 dict(name='Ржавое сердце',key=50,scale='dorian',bpm=76,bars=20,lead='piano',chords=[0,3,5,4],motif=[0,2,4,-1,3,2,0,-1,5,4,2,1,0,-1,2,-1],mood='exploration',character='industrial',description='Неровный пульс забытого города. Фортепиано, щипковые струны и паровые машины.'),
 dict(name='Тихие шестерни',key=53,scale='major',bpm=60,bars=16,lead='celesta',chords=[0,3,4,5],motif=[0,-1,4,-1,2,-1,1,-1,0,2,4,-1,1,-1,0,-1],mood='rest',character='quiet',description='Тепло маяка. Редкие ноты челесты над спокойным струнным дыханием.'),
 dict(name='Страж свалки',key=45,scale='minor',bpm=116,bars=24,lead='brass',chords=[0,0,5,4],motif=[0,0,4,3,0,2,1,4,0,4,5,4,2,1,0,-1],mood='boss',character='battle',description='Тяжёлые медные аккорды и удары огромных поршней. Первый хранитель пробуждается.'),
 dict(name='Улицы без имён',key=48,scale='minor',bpm=64,bars=16,lead='flute',chords=[0,5,3,4],motif=[4,-1,3,2,-1,0,-1,1,2,-1,4,3,2,-1,0,-1],mood='ambient',character='ruins',description='Флейта проходит между пустыми домами. Никто не зажигает фонари.'),
 dict(name='Медный марш',key=50,scale='dorian',bpm=92,bars=20,lead='pluck',chords=[0,6,3,4],motif=[0,2,3,4,2,-1,1,2,0,4,5,6,4,2,1,-1],mood='exploration',character='industrial',description='Упругий ритм струн и медных барабанов ведёт по железным мостам.'),
 dict(name='Погасшие фонари',key=47,scale='minor',bpm=104,bars=20,lead='strings',chords=[0,4,5,1],motif=[0,4,3,-1,2,4,5,4,3,2,1,-1,0,1,2,-1],mood='combat',character='battle',description='Тревожные струнные, приглушённая медь и торопливый пульс погони.'),
 dict(name='Сторож часов',key=46,scale='harmonic',bpm=124,bars=24,lead='bell',chords=[0,3,4,0],motif=[0,4,6,4,3,2,1,4,0,2,4,6,5,4,1,0],mood='boss',character='battle',description='Механический вальс судовых колоколов. Хронос отсчитывает последние секунды.'),
 dict(name='Сад памяти',key=53,scale='major',bpm=56,bars=16,lead='celesta',chords=[0,5,3,4],motif=[4,-1,2,-1,0,-1,1,2,-1,4,6,-1,4,2,0,-1],mood='ambient',character='quiet',description='Светлая печаль челесты, воздушная флейта и шелест механических цветов.'),
 dict(name='Эхо людей',key=55,scale='dorian',bpm=68,bars=18,lead='flute',chords=[0,3,1,4],motif=[2,4,5,-1,4,2,1,-1,0,1,2,4,2,-1,0,-1],mood='exploration',character='quiet',description='Человеческий голос, которого больше нет. Тёплые духовые и фортепианные воспоминания.'),
 dict(name='Хранительница тишины',key=52,scale='minor',bpm=108,bars=24,lead='strings',chords=[0,5,3,4],motif=[6,-1,5,4,2,4,3,1,0,3,4,5,4,2,1,0],mood='boss',character='battle',description='Струнные взлетают над тяжёлым пульсом. Мнемоза защищает последнюю память.'),
 dict(name='Золото и пар',key=48,scale='harmonic',bpm=96,bars=24,lead='piano',chords=[0,3,4,5],motif=[0,4,2,5,4,1,3,2,0,6,4,2,1,4,2,0],mood='exploration',character='industrial',description='Имперский трёхдольный танец. За позолотой слышится работа тысяч механизмов.'),
 dict(name='Восхождение',key=50,scale='minor',bpm=84,bars=24,lead='strings',chords=[0,3,5,4],motif=[0,1,2,3,4,5,6,4,5,6,7,6,4,2,1,0],mood='exploration',character='industrial',description='Восходящие струнные секции и мерный шаг. Вершина уже близко.'),
 dict(name='Император шестерён',key=43,scale='harmonic',bpm=132,bars=28,lead='brass',chords=[0,5,4,0],motif=[0,0,6,4,5,4,1,0,4,5,6,7,6,4,1,0],mood='boss',character='battle',description='Полная медная секция, низкие струнные и удары трона. Лицом к лицу с создателем.'),
 dict(name='Над облаками',key=55,scale='major',bpm=62,bars=16,lead='piano',chords=[0,3,4,0],motif=[0,-1,2,4,-1,6,4,-1,2,1,0,-1,4,2,0,-1],mood='ending',character='quiet',description='Последняя тема: большое фортепиано, светлые струнные и тишина свободного мира.'),
]
SCALES={'major':[0,2,4,5,7,9,11],'minor':[0,2,3,5,7,8,10],'dorian':[0,2,3,5,7,9,10],'harmonic':[0,2,3,5,7,8,11]}

def degree_note(key, scale, degree, octave=0):
    s=SCALES[scale]
    return key+s[degree%7]+12*(degree//7)+octave

def make_track(index, spec):
    beat=60/spec['bpm']
    beats_per_bar=3 if index==11 else 4
    duration=spec['bars']*beats_per_bar*beat
    buf=np.zeros((int(duration*SR),2),dtype=np.float64)
    key=spec['key']; scale=spec['scale']; motif=spec['motif']
    mood=spec['mood']; intense=mood in ('boss','combat')
    lead=spec['lead']
    for bar in range(spec['bars']):
        at=bar*beats_per_bar*beat
        chord=spec['chords'][bar%len(spec['chords'])]
        chord_notes=[degree_note(key,scale,chord),degree_note(key,scale,chord+2),degree_note(key,scale,chord+4)]
        # Suspended, slowly changing string pads; the circular arrangement wraps their tails.
        for j,n in enumerate(chord_notes):
            velocity=.065 if mood in ('ambient','rest') else .047 if intense else .065
            sound=instrument(n,beats_per_bar*beat+.6,'strings',velocity)
            add(buf,sound,at,(j-1)*.48)
        bass=instrument(degree_note(key,scale,chord,-12),beat*2.8,'bass',.16 if intense else .11)
        add(buf,bass,at,0)
        if mood not in ('ambient','rest'):
            for j in range(1,beats_per_bar):
                n=chord_notes[(j+bar)%3]
                add(buf,instrument(n+12,beat*1.7,'pluck' if index in (1,5,11) else 'piano',.085),at+j*beat,(-.35 if j%2 else .35))
        if intense:
            add(buf,instrument(degree_note(key,scale,chord,-12),beat*1.8,'bow',.07),at,-.2)
            for j in range(beats_per_bar*2):
                n=chord_notes[j%3]+(12 if j%4==3 else 0)
                add(buf,instrument(n,beat*.85,'bow',.065),at+j*beat*.5,(-.45 if j%2 else .45))
            for j in range(beats_per_bar):
                if j in (0,2): add(buf,drum('tom',.32 if mood=='boss' else .2),at+j*beat,-.08)
                if j in (1,3): add(buf,drum('metal',.28),at+j*beat,.38)
            if mood=='boss':
                for j,n in enumerate(chord_notes): add(buf,instrument(n,beat*1.2,'brass',.065),at,(j-1)*.35)
        elif mood=='exploration':
            add(buf,drum('tom',.12),at,-.1)
            add(buf,drum('metal',.10),at+beat*2,.4)
        # Two-bar original phrase, with variation and an answering voice.
        for step in range(beats_per_bar*2):
            mi=(bar*beats_per_bar*2+step)%len(motif)
            deg=motif[mi]
            if deg<0 or (mood in ('ambient','rest') and step%2 and bar%2): continue
            phrase=bar//4
            variation=1 if phrase%3==2 and step in (2,5) else 0
            octave=12 if lead in ('flute','celesta','bell') else 0
            n=degree_note(key,scale,deg+variation,octave)
            length=beat*(1.65 if mood in ('ambient','rest') else .95)
            vel=.14 if lead=='flute' else .16 if lead in ('bell','celesta') else .13
            if mood=='rest': vel*=.78
            add(buf,instrument(n,length,lead,vel),at+step*beat*.5,.18*math.sin(bar*.7+step))
            if intense and step%4==0:
                add(buf,instrument(n-12,length,'brass',.07),at+step*beat*.5,-.25)
            if mood in ('ambient','ending') and step==0:
                add(buf,instrument(n+7,beat*2.7,'piano',.065),at+.03,-.4)
        if index in (8,9,14) and bar%2==0:
            add(buf,instrument(degree_note(key,scale,chord+4,24),beat*3,'flute',.055),at+beat,.55)
    ambience(buf,spec['character'],intense)
    room(buf,.85 if mood in ('ambient','rest','ending') else .55)
    # Gentle saturation, DC removal, conservative peak normalization. No edge fade: seamless score.
    buf-=np.mean(buf,axis=0)
    buf=np.tanh(buf*1.15)
    peak=np.max(np.abs(buf))
    buf*=.77/max(peak,.01)
    path=OUT/f'{index+1:02d}.ogg'
    with sf.SoundFile(path, 'w', SR, 2, format='OGG', subtype='VORBIS') as output:
        for offset in range(0, len(buf), 16384): output.write(buf[offset:offset+16384])
    print(f'{index+1:02d} {spec["name"]}: {duration:.1f}s, {path.stat().st_size//1024} KB',flush=True)
    return {k:v for k,v in spec.items() if k not in ('motif','chords','scale','key')} | {'id':index,'file':f'{index+1:02d}.ogg','duration':round(duration,2)}

def make_sfx():
    specs={}
    for name,dur in [('sword',.32),('hit',.3),('hurt',.5),('jump',.24),('dash',.42),('land',.2),('pickup',.65),('heal',1.3),('unlock',1.8),('steam',.65),('boss',1.5),('step',.13),('break',.65),('click',.12)]:
        t=seconds(dur)
        if name=='sword':
            x=filter_noise(len(t),650,5200)*np.sin(np.pi*t/dur)**2*.35
            x+=sum(np.sin(TAU*f*t)*np.exp(-t*22) for f in [710,1180,1720])*.075
        elif name in ('hit','break'):
            x=filter_noise(len(t),200,3800)*np.exp(-t*22)*.3
            x+=sum(np.sin(TAU*f*t)*np.exp(-t*(12+i*4)) for i,f in enumerate([184,397,681,1120]))*.12
        elif name=='hurt':
            x=np.sin(TAU*(90*t+30*(1-np.exp(-t*10))))*np.exp(-t*8)*.4+filter_noise(len(t),200,1800)*np.exp(-t*13)*.22
        elif name=='jump':
            x=filter_noise(len(t),400,2300)*np.sin(np.pi*t/dur)**2*.14+np.sin(TAU*(170*t+130*t*t))*np.exp(-t*20)*.09
        elif name in ('dash','steam'):
            x=filter_noise(len(t),500,6000)*np.sin(np.pi*t/dur)**1.5*(.26 if name=='dash' else .16)
            x+=np.sin(TAU*87*t)*np.exp(-t*14)*.07
        elif name=='land': x=drum('tom',.45)[:len(t)]+filter_noise(len(t),180,1400)*np.exp(-t*35)*.14
        elif name=='step': x=filter_noise(len(t),140,1400)*np.exp(-t*45)*.18+np.sin(TAU*117*t)*np.exp(-t*50)*.1
        elif name in ('pickup','heal','unlock','click'):
            x=np.zeros_like(t)
            notes=[74,81] if name=='pickup' else [62,66,69,74] if name=='heal' else [57,64,69,73,78] if name=='unlock' else [78]
            for i,n in enumerate(notes):
                s=instrument(n,min(.55,dur-i*.09),'celesta',.2 if name!='click' else .1)
                start=int(i*.085*SR); x[start:start+len(s)]+=s[:max(0,len(x)-start)]
            x*=np.minimum(1,(dur-t)/.08)
        else:
            x=instrument(38,dur,'brass',.35)+filter_noise(len(t),90,950)*envelope(t,.2,.4)*.15
            x[:min(len(t),int(.7*SR))]+=drum('tom',.45)[:len(t)]
        x=np.tanh(x*1.2); x*=.72/max(np.max(np.abs(x)),.01)
        stereo=np.column_stack((x,np.roll(x,11)*.97))
        with sf.SoundFile(OUT/f'sfx-{name}.ogg', 'w', SR, 2, format='OGG', subtype='VORBIS') as output: output.write(stereo)
        specs[name]=f'sfx-{name}.ogg'
    return specs

if __name__=='__main__':
    manifest=[]
    for i,spec in enumerate(TRACKS): manifest.append(make_track(i,spec))
    effects=make_sfx()
    (OUT/'manifest.json').write_text(json.dumps({'tracks':manifest,'effects':effects},ensure_ascii=False,indent=2),encoding='utf-8')
    print('Original soundtrack complete: 15 tracks + 14 effects.',flush=True)
