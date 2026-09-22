document.addEventListener("DOMContentLoaded", async () => {
    const welcomeMessage = document.getElementById("welcome-message");
    const welcomeSubtext = document.getElementById("welcome-subtext");
    const currentDateTime = document.getElementById("current-datetime");

    // Função para obter a saudação com base no horário
    const getGreeting = () => {
        const currentHour = new Date().getHours();

        if (currentHour >= 5 && currentHour < 12) {
            return "Bom dia";
        } else if (currentHour >= 12 && currentHour < 18) {
            return "Boa tarde";
        } else {
            return "Boa noite";
        }
    };

    const getPeriodHint = () => {
        const currentHour = new Date().getHours();

        if (currentHour >= 5 && currentHour < 12) {
            return "Periodo da manha: organize os agendamentos e prioridades da coordenacao.";
        }
        if (currentHour >= 12 && currentHour < 18) {
            return "Periodo da tarde: acompanhe alteracoes e disponibilidade das salas.";
        }
        return "Periodo da noite: revise pendencias e prepare as acoes do proximo dia.";
    };

    const updateDateTime = () => {
        if (!currentDateTime) {
            return;
        }

        const now = new Date();
        const formatted = new Intl.DateTimeFormat("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(now);

        currentDateTime.textContent = formatted;
    };

    try {
        // Faz a requisição para obter os dados do usuário
        const response = await fetch('/user-info');
        
        if (response.ok) {
            const user = await response.json();
            const nomeCompleto = user.nome || 'usuário'; // Exibe o nome do usuário
            welcomeMessage.textContent = `${getGreeting()}, ${nomeCompleto}!`;
        } else {
            welcomeMessage.textContent = `${getGreeting()}, usuário!`;
        }
    } catch (error) {
        console.error('Erro ao buscar informações do usuário:', error);
        welcomeMessage.textContent = `${getGreeting()}, usuário!`;
    }

    if (welcomeSubtext) {
        welcomeSubtext.textContent = getPeriodHint();
    }

    updateDateTime();
    setInterval(updateDateTime, 60000);
});
