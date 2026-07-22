/**
 * API Utility Functions für Company-related Operations
 * Ersetzt direkte Firebase-Calls im Frontend
 */

// Company API Functions
export async function getCompanyData(uid: string) {
  const response = await fetch(`/api/companies/${uid}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export async function updateCompanyTemplate(uid: string, template: string) {
  const response = await fetch(`/api/companies/${uid}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      preferredInvoiceTemplate: template,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Customer API Functions
export async function getCustomers(uid: string) {
  const response = await fetch(`/api/companies/${uid}/customers`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export async function createCustomer(uid: string, customerData: any) {
  const response = await fetch(`/api/companies/${uid}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerData),
  });

  const data = await response.json();

  // Bei Duplikat (409) geben wir die Response zurück statt Fehler zu werfen
  if (response.status === 409) {
    return data;
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }

  return data;
}

export async function updateCustomer(uid: string, customerId: string, customerData: any) {
  const response = await fetch(`/api/companies/${uid}/customers/${customerId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Invoice API Functions
export async function getInvoices(uid: string) {
  const response = await fetch(`/api/companies/${uid}/invoices`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export async function createInvoice(uid: string, invoiceData: any) {
  const response = await fetch(`/api/companies/${uid}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(invoiceData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Category API Functions
export async function getCategories() {
  const response = await fetch('/api/v1/categories', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export async function createCategory(categoryData: any) {
  const response = await fetch('/api/v1/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(categoryData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

// Generic API Error Handler
export function handleApiError(error: any) {
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const message = error.response.data?.error || error.message;

    switch (status) {
      case 400:
        throw new Error(`Ungültige Anfrage: ${message}`);
      case 401:
        throw new Error('Nicht authentifiziert');
      case 403:
        throw new Error('Zugriff verweigert');
      case 404:
        throw new Error('Ressource nicht gefunden');
      case 500:
        throw new Error('Interner Serverfehler');
      default:
        throw new Error(`Server-Fehler (${status}): ${message}`);
    }
  } else if (error.request) {
    // Network error
    throw new Error('Netzwerk-Fehler: Keine Antwort vom Server');
  } else {
    // Other error
    throw new Error(`Fehler: ${error.message}`);
  }
}
