import { format } from "date-fns-tz";

export function isAktifSekarang(alat) {
  if (!alat.jadwal_nyala || !alat.jadwal_mati) return true;

  const now = new Date();
  const timeZone = "Asia/Jakarta";

  const nowFormatted = format(now, "HH:mm", { timeZone });
  const [nowHour, nowMinute] = nowFormatted.split(":").map(Number);
  const nowMin = nowHour * 60 + nowMinute;

  const nyalaFormatted = format(alat.jadwal_nyala, "HH:mm", { timeZone });
  const matiFormatted = format(alat.jadwal_mati, "HH:mm", { timeZone });

  const [nyalaHour, nyalaMinute] = nyalaFormatted.split(":").map(Number);
  const [matiHour, matiMinute] = matiFormatted.split(":").map(Number);

  const nyalaMin = nyalaHour * 60 + nyalaMinute;
  const matiMin = matiHour * 60 + matiMinute;

  console.log(
    `[Helper] Pengecekan Jadwal untuk alat ${alat.id} ${alat.name}: Sekarang Jam ${nowFormatted} | Jadwal Alat Aktif ${nyalaFormatted} - ${matiFormatted}`
  );

  if (matiMin <= nyalaMin) {
    return nowMin >= nyalaMin || nowMin < matiMin;
  } else {
    return nowMin >= nyalaMin && nowMin < matiMin;
  }
}
