const SUPABASE_URL = 'https://chcemondfyqdreqdqkxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CspBzD2ChSg_zLU_kX19wg_AfRG2c-b';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cargarDashboard() {
    const { data: clientes, error } = await _supabase
        .from('clientes')
        .select('*');

    if (error) {
        console.error("Error al cargar estadísticas:", error);
        return;
    }

    if (!clientes) return;

    // Obtener la fecha de hoy en formato YYYY-MM-DD sin problemas de hora
    const hoyStr = new Date().toISOString().split('T')[0];
    const [yearHoy, mesHoy, diaHoy] = hoyStr.split('-').map(Number);
    const fechaHoyNum = new Date(yearHoy, mesHoy - 1, diaHoy).getTime();

    let activos = 0;
    let vencidos = 0;
    let ingresosTotales = 0;

    clientes.forEach(c => {
        ingresosTotales += parseFloat(c.monto || 0);

        // Limpiar la fecha de vencimiento de la base de datos (extraer solo YYYY-MM-DD)
        const fechaVencStr = c.fecha_vencimiento.split('T')[0];
        const [yearVenc, mesVenc, diaVenc] = fechaVencStr.split('-').map(Number);
        const fechaVencNum = new Date(yearVenc, mesVenc - 1, diaVenc).getTime();

        // Comparar directamente los números de fecha
        if (fechaVencNum < fechaHoyNum) {
            vencidos++;
        } else {
            activos++;
        }
    });

    document.getElementById('stat-activos').textContent = activos;
    document.getElementById('stat-vencidos').textContent = vencidos;
    document.getElementById('stat-ingresos').textContent = `$${ingresosTotales.toFixed(2)}`;
}

cargarDashboard();