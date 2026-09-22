// public/js/sessionTimer.js

let timerInterval = null;

// Função utilitária para formatar segundos em HH:MM:SS
function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Função principal que busca o tempo no servidor e inicia o timer local
async function updateSessionTimer() {
    const timerElement = document.getElementById('session-timer');
    // Se o elemento não existir, não faz nada
    if (!timerElement) {
        clearInterval(timerInterval);
        timerInterval = null;
        return;
    }
    
    try {
        // Faz a chamada para a rota que você criou no server.js
        const response = await fetch('/session-info');
        
        if (!response.ok) {
            // Se o servidor retornar erro ou 404, a sessão expirou
            timerElement.textContent = "00:00:00";
            clearInterval(timerInterval);
            alert("Sua sessão expirou. Você será redirecionado para o login.");
            window.location.href = '/login';
            return;
        }

        const data = await response.json();
        let tempoRestante = data.tempoRestante;

        if (tempoRestante > 0) {
            // Exibe o tempo exato retornado pelo servidor
            timerElement.textContent = formatTime(tempoRestante);
            
            // Inicia o contador regressivo local se ainda não estiver ativo
            if (!timerInterval) {
                timerInterval = setInterval(() => {
                    tempoRestante--;
                    if (tempoRestante <= 0) {
                        // Quando o tempo acabar localmente, redireciona
                        timerElement.textContent = "00:00:00";
                        clearInterval(timerInterval);
                        alert("Sua sessão expirou. Você será redirecionado para o login.");
                        window.location.href = '/login';
                    } else {
                        timerElement.textContent = formatTime(tempoRestante);
                    }
                }, 1000); // Roda a cada 1 segundo
            }
        } else {
             // Tempo restante 0, força o redirecionamento
             timerElement.textContent = "00:00:00";
             alert("Sua sessão expirou. Você será redirecionado para o login.");
             window.location.href = '/login';
        }

    } catch (error) {
        // console.error('Erro ao buscar informações da sessão:', error);
        timerElement.textContent = "Erro na conexão";
        // Em caso de erro, o intervalo de sincronização tentará buscar novamente
    }
}

// Inicia a função quando a página carrega
document.addEventListener('DOMContentLoaded', updateSessionTimer);

// Sincroniza o timer com o servidor a cada 60 segundos para corrigir o desvio de tempo
// (Isso garante que o timer local nunca fique muito dessincronizado do tempo real do servidor)
setInterval(() => {
    if (timerInterval) {
        clearInterval(timerInterval); // Para o contador local antigo
        timerInterval = null;
    }
    updateSessionTimer(); // Busca o tempo exato no servidor e inicia um novo contador
}, 60000); // A cada 1 minuto (60 segundos)