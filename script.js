// --- 1. CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://chcemondfyqdreqdqkxg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CspBzD2ChSg_zLU_kX19wg_AfRG2c-b';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- TABLA DE PRECIOS ACTUALIZADA ---
const PRECIOS_PLANES = {
    "Solo máquinas": { Diario: 5, Semanal: 15, Mensual: 45 },
    "Guiado": { Semanal: 20, Mensual: 65 },
    "Asistido": { Diario: 8, Semanal: 25, Mensual: 90 },
    "Personalizado": { Semanal: 40, Mensual: 150 },
    "Edad plateada grupal": { Mensual: 60 },
    "Edad plateada individual": { Mensual: 90 },
    "Funcional híbrido": { Diario: 6, Mensual: 45 },
    "Funcional híbrido B": { Diario: 4, Mensual: 25 }
};

// --- AUTOPRELLENADO DE MONTO SEGÚN PLAN Y MODALIDAD ---
const selectPlan = document.getElementById('plan');
const selectModalidad = document.getElementById('modalidad');
const inputMonto = document.getElementById('monto');
const inputFechaPago = document.getElementById('fecha_pago');

if (inputFechaPago) {
    const hoy = new Date().toISOString().split('T')[0];
    inputFechaPago.value = hoy;
}

function actualizarMontoSugerido() {
    if (!selectPlan || !selectModalidad || !inputMonto) return;
    const plan = selectPlan.value;
    const modalidad = selectModalidad.value;

    if (plan && modalidad && PRECIOS_PLANES[plan] && PRECIOS_PLANES[plan][modalidad]) {
        inputMonto.value = PRECIOS_PLANES[plan][modalidad];
    }
}

if (selectPlan) selectPlan.addEventListener('change', actualizarMontoSugerido);
if (selectModalidad) selectModalidad.addEventListener('change', actualizarMontoSugerido);

function calcularFechaVencimiento(fechaPagoStr, modalidad) {
    const [year, month, day] = fechaPagoStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);

    if (modalidad === 'Diario') {
        fecha.setDate(fecha.getDate() + 1);
    } else if (modalidad === 'Semanal') {
        fecha.setDate(fecha.getDate() + 7);
    } else if (modalidad === 'Mensual') {
        fecha.setMonth(fecha.getMonth() + 1);
    }

    return fecha.toISOString().split('T')[0];
}

// --- SISTEMA DE NOTIFICACIONES Y SONIDO ---
function solicitarPermisoNotificaciones() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function reproducirAlertaSonora() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // Tono de alerta (Re5)
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4); // Dura 0.4 segundos
    } catch (e) {
        console.log("Audio bloqueado por el navegador hasta que haya interacción.", e);
    }
}

function dispararNotificacionDispositivo(titulo, mensaje) {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
        new Notification(titulo, { body: mensaje });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(titulo, { body: mensaje });
            }
        });
    }
}

// --- REGISTRAR NUEVO CLIENTE / PAGO ---
const formCliente = document.getElementById('form-cliente');
if (formCliente) {
    formCliente.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnGuardar = document.getElementById('btn-guardar');
        const mensajeEstado = document.getElementById('mensaje-estado');
        mensajeEstado.textContent = "";
        btnGuardar.textContent = "Guardando...";
        btnGuardar.disabled = true;

        try {
            const cedula = document.getElementById('cedula').value.trim();
            const nombre = document.getElementById('nombre').value.trim();
            const apellido = document.getElementById('apellido').value.trim();
            const celular = document.getElementById('celular').value.trim();
            const metodo_pago = document.getElementById('metodo_pago').value;
            const plan = document.getElementById('plan').value;
            const modalidad = document.getElementById('modalidad').value;
            const monto = parseFloat(document.getElementById('monto').value);
            const fecha_pago = document.getElementById('fecha_pago').value;
            const cobrado_por = document.getElementById('cobrado_por').value.trim();
            const inputFoto = document.getElementById('foto');

            let foto_url = "";

            if (inputFoto && inputFoto.files.length > 0) {
                const archivo = inputFoto.files[0];
                const nombreArchivo = `${Date.now()}_${archivo.name}`;
                
                const { data: uploadData, error: uploadError } = await _supabase.storage
                    .from('fotos_clientes')
                    .upload(nombreArchivo, archivo);

                if (uploadError) throw uploadError;

                const { data: publicURLData } = _supabase.storage
                    .from('fotos_clientes')
                    .getPublicUrl(nombreArchivo);

                foto_url = publicURLData.publicUrl;
            }

            const fecha_vencimiento = calcularFechaVencimiento(fecha_pago, modalidad);
            const estado = 'Activo';

            const { data: clienteExistente } = await _supabase
                .from('clientes')
                .select('id')
                .eq('cedula', cedula)
                .maybeSingle();

            let errorDb;

            if (clienteExistente) {
                const { error } = await _supabase
                    .from('clientes')
                    .update({
                        nombre, apellido, celular, metodo_pago, plan, modalidad, monto, fecha_pago, fecha_vencimiento, estado, cobrado_por,
                        ...(foto_url ? { foto_url } : {})
                    })
                    .eq('cedula', cedula);
                errorDb = error;
            } else {
                const { error } = await _supabase
                    .from('clientes')
                    .insert([{
                        cedula, nombre, apellido, celular, metodo_pago, foto_url, plan, modalidad, monto, fecha_pago, fecha_vencimiento, estado, cobrado_por
                    }]);
                errorDb = error;
            }

            if (errorDb) throw errorDb;

            mensajeEstado.style.color = "green";
            mensajeEstado.textContent = "✅ ¡Cliente registrado y membresía activada con éxito!";
            formCliente.reset();
            if (inputFechaPago) inputFechaPago.value = new Date().toISOString().split('T')[0];
            
            cargarListasClientes();

        } catch (error) {
            console.error("Error al guardar:", error);
            mensajeEstado.style.color = "red";
            mensajeEstado.textContent = "❌ Error al guardar: " + (error.message || "Verifica tu conexión.");
        } finally {
            btnGuardar.textContent = "Guardar y Activar Membresía";
            btnGuardar.disabled = false;
        }
    });
}

// --- CARGAR Y DISTRIBUIR CLIENTES EN LAS LISTAS ---
async function cargarListasClientes() {
    solicitarPermisoNotificaciones();

    const listaActivos = document.getElementById('lista-activos');
    const listaVencidos = document.getElementById('lista-vencidos');

    if (!listaActivos || !listaVencidos) return;

    const { data: clientes, error } = await _supabase
        .from('clientes')
        .select('*')
        .order('fecha_vencimiento', { ascending: true });

    if (error) {
        console.error("Error al cargar clientes:", error);
        listaActivos.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error al cargar datos.</td></tr>`;
        return;
    }

    if (!clientes || clientes.length === 0) {
        listaActivos.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay clientes registrados.</td></tr>`;
        listaVencidos.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay deudores registrados.</td></tr>`;
        return;
    }

    const hoyStr = new Date().toISOString().split('T')[0];
    const [yearHoy, mesHoy, diaHoy] = hoyStr.split('-').map(Number);
    const fechaHoyNum = new Date(yearHoy, mesHoy - 1, diaHoy).getTime();

    let htmlActivos = '';
    let htmlVencidos = '';

    let contadorActivos = 0;
    let contadorVencidos = 0;
    let clientesPorVencerManana = [];

    for (let cliente of clientes) {
        const fechaVencStr = cliente.fecha_vencimiento.split('T')[0];
        const [yearVenc, mesVenc, diaVenc] = fechaVencStr.split('-').map(Number);
        const fechaVencNum = new Date(yearVenc, mesVenc - 1, diaVenc).getTime();
        
        const diferenciaTiempo = fechaVencNum - fechaHoyNum;
        const diasRestantes = Math.round(diferenciaTiempo / (1000 * 60 * 60 * 24));

        let estadoVisual = 'Activo';
        let claseBadge = 'badge-activo';

        if (diasRestantes < 0) {
            estadoVisual = 'Vencido';
            claseBadge = 'badge-vencido';
        } else if (diasRestantes <= 2) {
            estadoVisual = 'Por vencer';
            claseBadge = 'badge-por-vencer';
        }

        if (diasRestantes === 1) {
            clientesPorVencerManana.push(`${cliente.nombre} ${cliente.apellido}`);
        }

        // LÓGICA DE FILTRADO (Opción 1 Pura):
        // 1. Si es un cliente Mensual y está vencido -> va a la tabla de Vencidos/Deudores.
        // 2. Si es Diario o Semanal y ya expiró (diasRestantes < 0) -> SE OCULTA de la pantalla principal.
        // 3. Si está activo o por vencer -> se muestra en la tabla de activos.
        if (diasRestantes < 0) {
            if (cliente.modalidad === 'Mensual') {
                contadorVencidos++;
                const diasVencido = Math.abs(diasRestantes);
                htmlVencidos += `
                    <tr>
                        <td><strong>${cliente.cedula}</strong></td>
                        <td>${cliente.nombre} ${cliente.apellido}</td>
                        <td><span class="badge badge-vencido">${diasVencido} días vencido</span></td>
                        <td>$${cliente.monto}</td>
                        <td><button class="btn-renovar" onclick="renovarCliente('${cliente.cedula}')">Renovar / Pagar</button></td>
                    </tr>
                `;
            }
            // Los diarios o semanales vencidos no hacen match con nada aquí, por lo que simplemente no se dibujan en la pantalla principal.
        } else {
            contadorActivos++;
            htmlActivos += `
                <tr>
                    <td><strong>${cliente.cedula}</strong></td>
                    <td>${cliente.nombre} ${cliente.apellido}</td>
                    <td>${cliente.plan} (${cliente.modalidad})</td>
                    <td><span class="badge ${claseBadge}">${estadoVisual}</span></td>
                    <td>${cliente.fecha_vencimiento}</td>
                </tr>
            `;
        }
    }

    if (clientesPorVencerManana.length > 0) {
        const ultimaAlertaManana = localStorage.getItem('gym_ultima_alerta_por_vencer');
        if (ultimaAlertaManana !== hoyStr) {
            reproducirAlertaSonora();
            const nombresListados = clientesPorVencerManana.join(', ');
            dispararNotificacionDispositivo(
                "⏳ Membresía por vencer mañana", 
                `Atención: A ${nombresListados} se le vence la membresía mañana.`
            );
            localStorage.setItem('gym_ultima_alerta_por_vencer', hoyStr);
        }
    }

    if (contadorVencidos > 0) {
        const ultimaAlertaVencidos = localStorage.getItem('gym_ultima_alerta_vencidos');
        if (ultimaAlertaVencidos !== hoyStr) {
            reproducirAlertaSonora();
            dispararNotificacionDispositivo(
                "⚠️ ¡Atención en el Gimnasio!", 
                `Hay ${contadorVencidos} cliente(s) con membresía mensual vencida que requieren cobro.`
            );
            localStorage.setItem('gym_ultima_alerta_vencidos', hoyStr);
        }
    }

    if (contadorActivos === 0) {
        listaActivos.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay clientes activos en este momento.</td></tr>`;
    } else {
        listaActivos.innerHTML = htmlActivos;
    }

    if (contadorVencidos === 0) {
        listaVencidos.innerHTML = `<tr><td colspan="5" style="text-align: center;">¡Excelente! No hay clientes deudores mensuales.</td></tr>`;
    } else {
        listaVencidos.innerHTML = htmlVencidos;
    }
}

async function renovarCliente(cedula) {
    const { data: cliente, error } = await _supabase
        .from('clientes')
        .select('*')
        .eq('cedula', cedula)
        .single();

    if (error || !cliente) {
        alert("No se pudo cargar la información del cliente.");
        return;
    }

    document.getElementById('cedula').value = cliente.cedula;
    document.getElementById('nombre').value = cliente.nombre;
    document.getElementById('apellido').value = cliente.apellido;
    document.getElementById('celular').value = cliente.celular || '';
    
    const inputMetodoPago = document.getElementById('metodo_pago');
    if (inputMetodoPago) {
        inputMetodoPago.value = cliente.metodo_pago || '';
    }

    document.getElementById('plan').value = cliente.plan;
    document.getElementById('modalidad').value = cliente.modalidad;
    document.getElementById('monto').value = cliente.monto;
    
    const inputCobrado = document.getElementById('cobrado_por');
    if (inputCobrado) {
        inputCobrado.value = cliente.cobrado_por || '';
    }
    
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fecha_pago').value = hoy;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('nombre').focus();
}

if (document.getElementById('lista-activos')) {
    cargarListasClientes();
}