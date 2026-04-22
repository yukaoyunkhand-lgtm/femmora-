# Femmora — Deploy заавар

## 1. GitHub repo үүсгэх

1. https://github.com/new руу орно
2. Repository name: `femmora-web`
3. Private сонгоно (захиалгын мэдээлэл хадгалдаг учир)
4. "Create repository" дарна

Дараа нь terminal дээр:
```bash
git remote add origin https://github.com/ТАНЫ_НЭР/femmora-web.git
git push -u origin master
```

---

## 2. Railway deploy

1. https://railway.app руу орж GitHub-аар нэвтэрнэ
2. "New Project" → "Deploy from GitHub repo" → `femmora-web` сонгоно
3. Railway автоматаар `package.json` дотрах `start` командыг ажиллуулна

### Environment Variables тохируулах

Railway dashboard → Variables tab → Add:

| Хувьсагч | Утга |
|----------|------|
| `PORT` | `3000` |
| `ADMIN_PASSWORD` | Нууц үг (өөрөө тааруулна) |
| `QPAY_USERNAME` | QPay merchant username |
| `QPAY_PASSWORD` | QPay merchant password |
| `QPAY_INVOICE_CODE` | QPay invoice code |
| `CALLBACK_URL` | `https://ТАНЫ-APP.railway.app/api/qpay/callback` |

### URL авах

Deploy дуусмагц Railway `*.railway.app` URL өгнө.
Жишээ: `https://femmora-web-production.railway.app`

---

## 3. Domain холбох (femmora.mn)

### Railway дээр:
1. Settings → Domains → "Add Custom Domain"
2. `femmora.mn` оруулна
3. Railway CNAME утга харуулна (жишээ: `femmora-web.up.railway.app`)

### Domain бүртгэгч дээр (name.mn / Datacom):
DNS тохиргоонд нэмнэ:

```
Type: CNAME
Name: www
Value: femmora-web.up.railway.app

Type: A (root domain хэрэв)
Name: @
Value: Railway IP (Railway dashboard-аас авна)
```

SSL сертификат Railway автоматаар суулгана (5-10 мин).

---

## 4. Захиалгын database persistent болгох

Одоогоор `orders.json` Railway дахь серверт хадгалагдана.
**Redeploy хийхэд өгөгдөл алдагдахгүй** — Railway volume ашиглана.

Railway dashboard → Storage → "Add Volume" → `/app` mount path

---

## Локал ажиллуулах

```bash
# .env файл үүсгэх
cp .env.example .env
# .env дотор нууц үгээ тавина

npm start
# → http://localhost:3000
# → http://localhost:3000/admin
```
