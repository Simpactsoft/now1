const currentProfile = {
  "id": "1295b662-fa20-40fd-abbb-3cd913f66af1",
  "email": "danai@gmail.com",
  "phone": "052-8882222",
  "first_name": "Dana",
  "last_name": "Itzhak",
  "display_name": "דנה יצחק",
  "contact_methods": '[{"type": "email", "value": "dana@impactsoft.co.il"}, {"type": "phone", "value": "+66544530944"}]'
};

let firstName = currentProfile.first_name;
let lastName = currentProfile.last_name;
if (!firstName && !lastName && currentProfile.display_name) {
    const parts = currentProfile.display_name.split(' ');
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
}

let emailFromMethod = null;
let phoneFromMethod = null;

// Simulate what JSON.parse might do if it's a string, or Postgres driver returning it
let contactMethods = typeof currentProfile.contact_methods === 'string' ? JSON.parse(currentProfile.contact_methods) : currentProfile.contact_methods;

if (Array.isArray(contactMethods)) {
    emailFromMethod = contactMethods.find((m) => m.type === 'email')?.value;
    phoneFromMethod = contactMethods.find((m) => m.type === 'phone')?.value;
} else if (typeof contactMethods === 'object' && contactMethods !== null) {
    emailFromMethod = contactMethods.email;
    phoneFromMethod = contactMethods.phone;
}

let email = emailFromMethod || currentProfile.email;
let phone = phoneFromMethod || currentProfile.phone;

const final = {
    ...currentProfile,
    first_name: firstName,
    last_name: lastName,
    email: email,
    phone: phone
};

console.log(JSON.stringify(final, null, 2));
