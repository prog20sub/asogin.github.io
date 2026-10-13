// --- VERIFICACIÓN DE SESIÓN ---
const sesionActual = JSON.parse(localStorage.getItem('gym_sesion'));
if (!sesionActual) {
    window.location.href = 'login.html';
}

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://chcemondfyqdreqdqkxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CspBzD2ChSg_zLU_kX19wg_AfRG2c-b';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let html5QrcodeScanner = null;

// --- PROCESAR Y REGISTRAR LA ASISTENCIA POR CÉDULA ---
async function procesarAsistencia(cedula) {
    const contenedorRes = document.getElementById('resultado-marcaje');
    const badge = document.getElementById('res-badge');
    const nombre = document.getElementById('res-nombre');
    const plan = document.getElementById('res-plan');

    contenedorRes.style.display = 'block';
    badge.textContent = "Verificando...";
    badge.style.background = "#333";
    badge.style.color = "#fff";

    try {
        // 1. Consultar si el cliente existe en la base de datos
        const { data: cliente, error: errorCliente } = await _supabase
            .from('clientes')
            .select('*')
            .eq('cedula', cedula.trim())
            .single();

        if (errorCliente || !cliente) {
            throw new Error("Cliente no registrado en la base de datos.");
        }

        // 2. Comprobar vigencia del plan
        const hoyStr = new Date().toISOString().split('T')[0];
        const fechaVencStr = cliente.fecha_vencimiento ? cliente.fecha_vencimiento.split('T')[0] : '';
        const esValido = fechaVencStr >= hoyStr;

        let estadoMembresia = esValido ? 'Activo' : 'Vencido';

        nombre.textContent = `${cliente.nombre} ${cliente.apellido}`;
        plan.textContent = `Plan: ${cliente.plan} (${cliente.sede})`;

        if (esValido) {
            badge.textContent = "🟢 ACCESO PERMITIDO - AL DÍA";
            badge.style.background = "rgba(76, 175, 80, 0.2)";
            badge.style.color = "#81c784";
            badge.style.border = "1px solid #4caf50";
        } else {
            badge.textContent = "🔴 ACCESO DENEGADO - MEMBRESÍA VENCIDA";
            badge.style.background = "rgba(244, 67, 54, 0.2)";
            badge.style.color = "#e57373";
            badge.style.border = "1px solid #f44336";
        }

        // 3. Registrar el ingreso en la tabla asistencias de Supabase
        const payloadAsistencia = {
            cedula: cliente.cedula,
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            sede: cliente.sede,
            plan: cliente.plan,
            estado_membresia: estadoMembresia,
            registrado_por: (sesionActual && sesionActual.usuario) ? sesionActual.usuario : 'Sistema'
        };

        const { error: errorInsert } = await _supabase
            .from('asistencias')
            .insert([payloadAsistencia]);

        if (errorInsert) {
            console.error("Error al insertar en Supabase:", errorInsert);
            alert("⚠️ El cliente fue verificado pero NO se pudo guardar el registro: " + errorInsert.message);
        } else {
            console.log("Asistencia registrada con éxito en Supabase.");
        }

        // 4. Actualizar la lista del historial en pantalla
        cargarHistorialAsistencias();

    } catch (err) {
        console.error("Error en procesarAsistencia:", err);
        nombre.textContent = "Consulta Fallida";
        plan.textContent = "-";
        badge.textContent = `❌ ${err.message}`;
        badge.style.background = "rgba(255, 0, 0, 0.2)";
        badge.style.color = "#ff4444";
        badge.style.border = "1px solid #ff4444";
    }
}

// --- REGISTRO MANUAL POR FORMULARIO ---
document.getElementById('form-marcar-asistencia').addEventListener('submit', (e) => {
    e.preventDefault();
    const cedula = document.getElementById('input-cedula-asistencia').value;
    procesarAsistencia(cedula);
});

// --- INICIAR CÁMARA DE CELULAR / ESCÁNER QR ---
function iniciarEscaner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
    }

    html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
    html5QrcodeScanner.render((qrCodeMessage) => {
        document.getElementById('input-cedula-asistencia').value = qrCodeMessage;
        procesarAsistencia(qrCodeMessage);
        html5QrcodeScanner.clear();
    });
}

// --- GENERAR Y MOSTRAR CARNET DIGITAL ---
async function generarCarnetDigital(cedula) {
    try {
        const { data: cliente, error } = await _supabase
            .from('clientes')
            .select('*')
            .eq('cedula', cedula.trim())
            .single();

        if (error || !cliente) {
            alert("No se encontró ningún cliente con esa cédula.");
            return;
        }

        document.getElementById('carnet-nombre').textContent = `${cliente.nombre} ${cliente.apellido}`;
        document.getElementById('carnet-cedula').textContent = `C.I: ${cliente.cedula}`;
        document.getElementById('carnet-plan').textContent = `Plan: ${cliente.plan} (${cliente.sede})`;

        const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(cliente.cedula)}`;
        document.getElementById('carnet-qr-img').src = urlQR;

        const btnWs = document.getElementById('btn-enviar-carnet-ws');
        const mensajeWS = `Hola ${cliente.nombre}, te adjuntamos tu Carnet Digital del Gimnasio Inclusivo Asogin. Preséntalo al ingresar para registrar tu asistencia. 💪`;
        btnWs.onclick = () => enviarWhatsApp(cliente.celular, mensajeWS);

        document.getElementById('modal-carnet').style.display = 'flex';

    } catch (err) {
        alert("Error al cargar el carnet: " + err.message);
    }
}

function generarCarnetDesdeInput() {
    const cedulaTest = document.getElementById('qr-cedula-test').value.trim();
    if (!cedulaTest) {
        alert("Ingresa una cédula válida para generar el carnet.");
        return;
    }
    generarCarnetDigital(cedulaTest);
}

function cerrarCarnet() {
    document.getElementById('modal-carnet').style.display = 'none';
}

// --- ENVIAR WHATSAPP AL CLIENTE ---
function enviarWhatsApp(celular, mensaje) {
    if (!celular || String(celular).toUpperCase().includes('N/A')) {
        alert("El cliente no tiene un número de celular válido registrado.");
        return;
    }

    let numeroLimpio = String(celular).replace(/\D/g, '');
    if (numeroLimpio.startsWith('0')) {
        numeroLimpio = '58' + numeroLimpio.substring(1);
    } else if (!numeroLimpio.startsWith('58')) {
        numeroLimpio = '58' + numeroLimpio;
    }

    const url = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// --- CARGAR HISTORIAL DE ASISTENCIAS ---
async function cargarHistorialAsistencias() {
    const tbody = document.getElementById('tabla-asistencias');
    const filtroTexto = document.getElementById('buscar-historial').value.toLowerCase();
    const filtroFecha = document.getElementById('filtro-fecha-asistencia').value;

    const { data: registros, error } = await _supabase
        .from('asistencias')
        .select('*')
        .order('fecha_hora', { ascending: false })
        .limit(50);

    if (error || !registros) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Sin registros de asistencia.</td></tr>`;
        return;
    }

    let html = '';
    for (let r of registros) {
        const fechaHoraLocal = new Date(r.fecha_hora).toLocaleString('es-VE');
        const coincideTexto = `${r.cedula} ${r.nombre} ${r.apellido}`.toLowerCase().includes(filtroTexto);
        const coincideFecha = !filtroFecha || r.fecha_hora.startsWith(filtroFecha);

        if (!coincideTexto || !coincideFecha) continue;

        const badgeEstado = r.estado_membresia === 'Activo'
            ? '<span style="color: #81c784;">🟢 Activo</span>'
            : '<span style="color: #e57373;">🔴 Vencido</span>';

        html += `
            <tr>
                <td>${fechaHoraLocal}</td>
                <td><strong>${r.cedula}</strong></td>
                <td>${r.nombre} ${r.apellido}</td>
                <td>${r.sede}</td>
                <td>${r.plan}</td>
                <td>${badgeEstado}</td>
            </tr>
        `;
    }

    tbody.innerHTML = html || `<tr><td colspan="6" style="text-align: center;">No coinciden registros.</td></tr>`;
}

// --- CERRAR SESIÓN ---
function cerrarSesion() {
    if (confirm("¿Deseas cerrar sesión?")) {
        localStorage.removeItem('gym_sesion');
        window.location.href = 'login.html';
    }
}

// Carga inicial del historial al abrir la página
cargarHistorialAsistencias();
