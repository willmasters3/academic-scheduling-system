document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById('loginForm');
    const temporaryForm = document.getElementById('temporaryPasswordForm');
    const temporaryMessage = document.getElementById('temporaryPasswordMessage');
    const temporaryFeedback = document.getElementById('temporaryPasswordFeedback');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');

    function showTemporaryPasswordFlow(message) {
        loginForm.classList.add('hidden');
        temporaryForm.classList.remove('hidden');
        temporaryMessage.textContent = message || 'Por segurança, sua senha temporária deve ser substituída por uma nova senha pessoal para liberar o acesso.';
        temporaryFeedback.textContent = '';
        temporaryFeedback.classList.remove('ok');
        newPassword.focus();
    }

    function setTemporaryFeedback(message, ok = false) {
        temporaryFeedback.textContent = message || '';
        temporaryFeedback.classList.toggle('ok', Boolean(ok));
    }
    
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o envio padrão do formulário

        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const payload = await response.json();
                    if (payload?.requiresPasswordReset) {
                        showTemporaryPasswordFlow(payload.message);
                        return;
                    }

                    if (payload?.redirectPath) {
                        window.location.href = payload.redirectPath;
                        return;
                    }
                }

                const redirectUrl = await response.text();
                window.location.href = redirectUrl;
            } else {
                const errorText = await response.text();
                alert(errorText); // Exibe uma mensagem de erro
            }
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            alert('Erro ao fazer login. Tente novamente mais tarde.');
        }
    });

    temporaryForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        setTemporaryFeedback('');
        const payload = {
            newPassword: String(newPassword.value || ''),
            confirmPassword: String(confirmPassword.value || '')
        };

        try {
            const response = await fetch('/login/temporary-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const mensagem = await response.text();
                setTemporaryFeedback(mensagem || 'Não foi possível atualizar a senha.');
                return;
            }

            const result = await response.json();
            setTemporaryFeedback(result?.message || 'Senha atualizada com sucesso.', true);

            if (result?.redirectPath) {
                window.location.href = result.redirectPath;
            }
        } catch (error) {
            console.error('Erro ao atualizar senha temporária:', error);
            setTemporaryFeedback('Erro de conexão. Tente novamente em instantes.');
        }
    });
});
