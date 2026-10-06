import {useEffect} from "react";
import loginService from "../../services/login-service";
import {useNavigate} from "react-router-dom";
import axios from "axios";

const backendHost = (process.env.REACT_APP_BACKEND_URI || 'http://localhost:8080');

function AfterLogin() {
    let service = loginService();
    const navigate = useNavigate();


    useEffect(() => {
        // Сначала получаем CSRF-токен
        const fetchCsrfToken = async () => {
            try {
                const response = await axios.get(backendHost + '/csrf', {
                    withCredentials: true
                });

                const { token, headerName } = response.data || {};
                if (typeof token !== 'string' || !/^[A-Za-z0-9_+/=-]{1,4096}$/.test(token)
                        || !['X-CSRF-TOKEN', 'X-XSRF-TOKEN'].includes(headerName)) {
                    throw new Error('Invalid CSRF response');
                }
                localStorage.setItem('csrfToken', token);
                // Never allow a response to select an arbitrary request header.
                localStorage.setItem('csrfHeaderName', headerName === 'X-XSRF-TOKEN'
                    ? 'X-XSRF-TOKEN' : 'X-CSRF-TOKEN');

                // После получения токена запрашиваем информацию о пользователе
                return service.getUserInfo();
            } catch (error) {
                console.error("Error fetching CSRF token:", error);
                throw error;
            }
        };

        fetchCsrfToken()
            .then((data) => {
                localStorage.removeItem('trackme.lastUserActivity');
                let roles = data.roles;
                let isAdmin = roles.includes("ADMIN");
                let isTracker = roles.includes("TRACKER");
                let isSuperadmin = roles.includes("SUPER_ADMIN");

                if (isAdmin) {
                    navigate("/streams");
                } else if (isTracker) {
                    navigate("/team-cards");
                } else if (isSuperadmin) {
                    navigate("/streams");
                } else {
                    navigate("/home");
                }
            })
            .catch(error => {
                console.error("Error during login:", error);
            });
    }, [navigate, service]);
}

export default AfterLogin;